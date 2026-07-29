import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { config } from "./config.js";
import { securityHeaders } from "./middleware/security.js";
import { logger } from "./lib/logger.js";
import { auth } from "./auth.js";
import { initAuth } from "./auth/middleware.js";
import { ensureCatalogLoaded } from "./inference/models.js";
import { authRoutes } from "./routes/auth.js";
import { modelRoutes } from "./routes/models.js";
import { healthRoutes } from "./routes/health.js";
import { metricsRoutes, metricsMiddleware } from "./routes/metrics.js";
import { x402Routes } from "./x402/facilitator.js";
import { chatRoutes } from "./routes/chat/index.js";
import { depositRoutes } from "./routes/deposit/index.js";
import type { OmaEnv } from "./types.js";
import { generateCorrelationId } from "./tracing.js";
import { db } from "./db/client.js";
import { user } from "./db/schema.js";
import { eq } from "drizzle-orm";
import { auditLog } from "./middleware/audit.js";

// Fail-fast admin address validation. Runs at startup, not at module
// import, so test imports of the auth middleware don't exit the process.
initAuth();

// Boot-time model catalog load.
void ensureCatalogLoaded();

if (config.CORS_ORIGIN === "*" && config.NODE_ENV === "production") {
  logger.fatal("[SECURITY] CORS_ORIGIN='*' is not allowed in production. Refusing to start. Set specific origins (comma-separated).");
  process.exit(1);
}

if (config.NODE_ENV === "production" && (!config.CSRF_SECRET || config.CSRF_SECRET.length < 32)) {
  const msg = config.CSRF_SECRET
    ? `CSRF_SECRET length is ${config.CSRF_SECRET.length} (minimum 32).`
    : "CSRF_SECRET is not set.";
  logger.fatal(`[SECURITY] ${msg} Refusing to start.`);
  process.exit(1);
}

const app = new Hono<OmaEnv>();

app.use("*", async (c, next) => {
  const correlationId = c.req.header("X-Correlation-ID") || generateCorrelationId();
  c.set("correlationId", correlationId);
  c.header("X-Request-ID", correlationId);
  await next();
});

app.use("*", compress());
app.use("*", securityHeaders);

const corsOptions = {
  origin: (origin: string | undefined): string | null => {
    if (!origin) return null;
    if (
      config.NODE_ENV === "development" &&
      (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1"))
    ) {
      return origin;
    }
    const allowedOrigins = config.CORS_ORIGIN.split(",").map((o) => o.trim());
    for (const allowed of allowedOrigins) {
      if (allowed === "*") {
        logger.warn({ origin }, "[CORS] Wildcard origin '*' is set. Credentials will be denied by browsers. Set specific origins in production.");
        return null;
      }
      try {
        const allowedUrl = new URL(allowed);
        const originUrl = new URL(origin);
        if (allowedUrl.origin === originUrl.origin) return origin;
      } catch {
        // ignore
      }
    }
    return null;
  },
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "PAYMENT-SIGNATURE", "PAYMENT-REQUIRED"],
  exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
  maxAge: 86400,
};

app.use("*", cors(corsOptions));
app.use("*", metricsMiddleware);

// Public operational routes.
app.route("/", healthRoutes);
app.route("/", metricsRoutes);

// Better Auth — sign-in / sign-up / magic-link / anonymous / SIWE / session.
app.all("/api/auth/*", (c) => auth.handler(c.req.raw));

// OMA-specific auth-adjacent routes (CSRF, /user, /keys).
app.route("/", authRoutes);

// OpenAI-compatible gateway surface.
app.route("/", modelRoutes);
app.route("/", chatRoutes);
app.route("/", depositRoutes);

// x402 payments.
app.route("/", x402Routes);

app.notFound((c) =>
  c.json({ error: { message: `Route ${c.req.path} not found`, type: "not_found" } }, 404),
);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  const correlationId = c.get("correlationId") as string | undefined;
  logger.error({ correlationId, error: err.message }, "[OMA] Unhandled error");
  const errWithStatus = err as Error & { status?: ContentfulStatusCode };
  const status = errWithStatus.status ?? 500;
  if (status >= 500) {
    return c.json({ error: { message: "Internal server error", type: "server_error" } }, 500);
  }
  const safeClientStatuses: ContentfulStatusCode[] = [400, 401, 403, 404, 409, 422, 429];
  if (safeClientStatuses.includes(status)) {
    return c.json({ error: { message: err.message, type: "client_error" } }, status);
  }
  return c.json({ error: { message: "Client error", type: "client_error" } }, status);
});

const server = serve({
  fetch: app.fetch,
  port: config.PORT,
}, (info) => {
  logger.info({ port: info.port }, "[OMA] API server running");
  logger.info({ healthUrl: `http://localhost:${info.port}/health` }, "[OMA] Health endpoint");
  logger.info({ modelsUrl: `http://localhost:${info.port}/v1/models` }, "[OMA] Models endpoint");
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    logger.error(
      { port: config.PORT },
      `[OMA] FATAL: port ${config.PORT} is already in use`,
    );
    process.exit(1);
  }
  throw err;
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, "[OMA] Shutdown signal received, closing gracefully...");
  server.close(async () => {
    logger.info("[OMA] HTTP server closed");
    try {
      const { closeRedisClient } = await import("./lib/redis-client.js");
      await closeRedisClient();
    } catch (err) {
      logger.warn({ error: err }, "[OMA] Redis close error");
    }
    process.exit(0);
  });
  setTimeout(() => {
    logger.error("[OMA] Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
};

if (config.NODE_ENV !== "test") {
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "Unhandled promise rejection — shutting down");
    shutdown("unhandledRejection");
  });
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception — shutting down");
    shutdown("uncaughtException");
  });
}

export default app;

// Self-link to avoid the unused-imports warning.
void db;
void user;
void eq;
void auditLog;
