import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { createServer } from "node:http";
import { sql } from "drizzle-orm";
import { config } from "./config.js";
import { securityHeaders } from "./middleware/security.js";
import { redisHealthCheck } from "./lib/redis-client.js";
import { db } from "./db/client.js";
import { healthCheck } from "./inference/provider-factory.js";
import { authRoutes } from "./routes/auth.js";
import { chatRoutes } from "./routes/chat.js";
import { setupWebSocket } from "./routes/chat-ws.js";
import { modelRoutes } from "./routes/models.js";
import { depositRoutes } from "./routes/deposit.js";
import { searchRoutes } from "./routes/search.js";
import { x402Routes } from "./x402/facilitator.js";
import { crosschainRoutes } from "./x402/crosschain.js";
import { onrampRoutes } from "./routes/onramp.js";
import { creditRoutes } from "./routes/credits.js";
import { adminRoutes } from "./routes/admin.js";
import { jupiterRoutes } from "./routes/jupiter.js";
import { teamsRouter } from "./routes/teams.js";
import { ssoRouter } from "./routes/sso.js";
import { queueRoutes } from "./routes/queue.js";
import { subscriptionRoutes } from "./routes/subscriptions.js";
import { configRoutes } from "./routes/config.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { adminAnalyticsRoutes } from "./routes/analytics-admin.js";
import { fetchRoutes } from "./routes/fetch.js";
import type { OmaEnv } from "./types.js";
import { scheduleCreditExpiry } from "./jobs/credit-expiry.js";
import { scheduleSubscriptionCheck } from "./jobs/subscription-cron.js";
import { generateCorrelationId } from "./tracing.js";

if (config.NODE_ENV !== "test") {
  scheduleCreditExpiry();
  scheduleSubscriptionCheck();
}

const app = new Hono<OmaEnv>();

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
      if (allowed === "*") {
        console.warn("[CORS] Wildcard origin '*' is set. Credentials will be denied by browsers. Set specific origins in production.");
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
  allowHeaders: ["Content-Type", "Authorization", "X-Houdini-Order-Id", "X-Houdini-Signature"],
  exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
  maxAge: 86400,
};

app.use("*", cors(corsOptions));
app.use("*", logger());

app.get("/health", async (c) => {
  const correlationId = c.get("correlationId") || generateCorrelationId();
  const checks: Record<string, unknown> = {};
  let allHealthy = true;
  let hasDegraded = false;

  // Redis check
  try {
    const redisResult = await Promise.race([
      redisHealthCheck(),
      new Promise<{ status: string }>((resolve) =>
        setTimeout(() => resolve({ status: "timeout" }), 2000)
      ),
    ]);
    checks.redis = redisResult;
    if (redisResult.status !== "ok") {
      allHealthy = false;
      if (redisResult.status === "timeout") {
        hasDegraded = true;
      }
    }
  } catch {
    checks.redis = { status: "error" };
    allHealthy = false;
  }

  // Database check
  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "ok", latency: Date.now() - start };
  } catch (err) {
    checks.database = { status: "error", error: err instanceof Error ? err.message : "Unknown error" };
    allHealthy = false;
  }

  // Venice API health check (if API key is configured)
  if (config.VENICE_API_KEY) {
    try {
      const veniceHealth = await Promise.race([
        healthCheck("venice", config.VENICE_API_URL.replace(/\/+$/, ""), "/api/v1/models", 5000),
        new Promise<{ isUp: boolean; latencyMs: number }>((resolve) =>
          setTimeout(() => resolve({ isUp: false, latencyMs: 5000 }), 5000)
        ),
      ]);
      checks.venice = { status: veniceHealth.isUp ? "ok" : "error", latency: veniceHealth.latencyMs };
      if (!veniceHealth.isUp) hasDegraded = true;
    } catch {
      checks.venice = { status: "error" };
      hasDegraded = true;
    }
  } else {
    checks.venice = { status: "not_configured" };
  }

  let status: "ok" | "degraded" | "error" = "ok";
  let httpStatus: ContentfulStatusCode = 200;
  if (!allHealthy) {
    status = "error";
    httpStatus = 503;
  } else if (hasDegraded) {
    status = "degraded";
  }

  return c.json({
    status,
    version: "2.0.0",
    service: "oma-ai",
    correlationId,
    checks,
  }, httpStatus);
});

app.route("/", authRoutes);
app.route("/", chatRoutes);
app.route("/", modelRoutes);
app.route("/", depositRoutes);
app.route("/", searchRoutes);
app.route("/", x402Routes);
app.route("/", crosschainRoutes);
app.route("/", onrampRoutes);
app.route("/", creditRoutes);
app.route("/", adminRoutes);
app.route("/", jupiterRoutes);
app.route("/teams", teamsRouter);
app.route("/sso", ssoRouter);
app.route("/v1/queue", queueRoutes);
app.route("/", configRoutes);
app.route("/", subscriptionRoutes);
app.route("/", analyticsRoutes);
app.route("/", adminAnalyticsRoutes);
app.route("/", fetchRoutes);

app.notFound((c) => c.json({ error: { message: `Route ${c.req.path} not found`, type: "not_found" } }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error(`[OMA] Unhandled error: ${err.message}`);
  const errWithStatus = err as Error & { status?: ContentfulStatusCode };
  const status = errWithStatus.status ?? 500;
  if (status >= 500) {
    return c.json({ error: { message: "Internal server error", type: "server_error" } }, 500);
  }
  return c.json({ error: { message: err.message, type: "client_error" } }, status);
});

const httpServer = createServer();

setupWebSocket(httpServer);

serve({
  fetch: app.fetch,
  createServer: () => httpServer,
  port: config.PORT,
}, (info) => {
  console.log(`[OMA] API server running on port ${info.port}`);
  console.log(`[OMA] Health: http://localhost:${info.port}/health`);
  console.log(`[OMA] Models: http://localhost:${info.port}/v1/models`);
  console.log(`[OMA] WebSocket: ws://localhost:${info.port}/v1/chat/completions/ws`);
});

export default app;