import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { config } from "./config.js";
import { securityHeaders } from "./middleware/security.js";
import { authRoutes } from "./routes/auth.js";
import { chatRoutes } from "./routes/chat.js";
import { modelRoutes } from "./routes/models.js";
import { depositRoutes } from "./routes/deposit.js";
import { stakingRoutes } from "./routes/staking.js";
import { x402Routes } from "./x402/facilitator.js";
import { crosschainRoutes } from "./x402/crosschain.js";
import { onrampRoutes } from "./routes/onramp.js";
import { jupiterRoutes } from "./lib/jupiter-client.js";
import type { OmaEnv } from "./types.js";
import { scheduleCreditExpiry } from "./jobs/credit-expiry.js";
import { generateCorrelationId } from "./tracing.js";

if (config.NODE_ENV !== "test") {
  scheduleCreditExpiry();
}

const app = new Hono<OmaEnv>();

// Add correlation ID middleware for each request
app.use("*", async (c, next) => {
  const correlationId = c.req.header("X-Correlation-ID") || generateCorrelationId();
  c.set("correlationId", correlationId);
  await next();
});

app.use("*", securityHeaders);

const corsOptions = {
  origin: (origin: string | undefined, _c: unknown): string | null => {
    if (!origin) return null;
    if (config.NODE_ENV === "development") return origin;
    const allowedOrigins = config.CORS_ORIGIN.split(",").map((o) => o.trim());
    for (const allowed of allowedOrigins) {
      if (allowed === "*") return origin;
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
  allowHeaders: ["Content-Type", "Authorization", "X-Houdini-Order-Id", "X-Houdini-Signature"],
  exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
  maxAge: 86400,
};

app.use("*", cors(corsOptions));
app.use("*", logger());

app.get("/health", (c) => {
  const correlationId = c.get("correlationId") || generateCorrelationId();
  return c.json({
    status: "ok",
    version: "0.1.0",
    service: "oma-ai",
    correlationId,
  });
});

app.route("/", authRoutes);
app.route("/", chatRoutes);
app.route("/", modelRoutes);
app.route("/", depositRoutes);
app.route("/", stakingRoutes);
app.route("/", x402Routes);
app.route("/", crosschainRoutes);
app.route("/", onrampRoutes);
app.route("/", jupiterRoutes);

app.notFound((c) => c.json({ error: { message: `Route ${c.req.path} not found`, type: "not_found" } }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error(`[OMA] Unhandled error: ${err.message}`, err.stack);
  const errWithStatus = err as Error & { status?: ContentfulStatusCode };
  const status = errWithStatus.status ?? 500;
  if (status >= 500) {
    return c.json({ error: { message: "Internal server error", type: "server_error" } }, 500);
  }
  return c.json({ error: { message: err.message, type: "client_error" } }, status);
});

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`[OMA] API server running on port ${info.port}`);
  console.log(`[OMA] Health: http://localhost:${info.port}/health`);
  console.log(`[OMA] Models: http://localhost:${info.port}/v1/models`);
});

export default app;
