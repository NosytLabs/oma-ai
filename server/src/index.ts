import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { createServer } from "node:http";
import { config } from "./config.js";
import { securityHeaders } from "./middleware/security.js";
import { logger } from "./lib/logger.js";
import { authRoutes } from "./routes/auth.js";
import { chatRoutes } from "./routes/chat/index.js";
import { modelRoutes } from "./routes/models.js";
import { depositRoutes } from "./routes/deposit/index.js";
import { searchRoutes } from "./routes/search.js";
import { x402Routes } from "./x402/facilitator.js";
import { crosschainRoutes } from "./x402/crosschain.js";
import { onrampRoutes } from "./routes/onramp.js";
import { creditRoutes } from "./routes/credits.js";
import { adminRoutes } from "./routes/admin/index.js";
import { jupiterRoutes } from "./routes/jupiter.js";
import { teamsRouter } from "./routes/teams.js";
import { ssoRouter } from "./routes/sso.js";
import { queueRoutes } from "./routes/queue.js";
import { subscriptionRoutes } from "./routes/subscriptions.js";
import { configRoutes } from "./routes/config.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { adminAnalyticsRoutes } from "./routes/analytics-admin.js";
import { fetchRoutes } from "./routes/fetch.js";
import { invoiceRoutes } from "./routes/invoices.js";
import { withdrawalRoutes } from "./routes/withdraw.js";
import { refundRoutes } from "./routes/refunds.js";
import { exportRoutes } from "./routes/export.js";
import type { OmaEnv } from "./types.js";
import { scheduleCreditExpiry } from "./jobs/credit-expiry.js";
import { scheduleSubscriptionCheck } from "./jobs/subscription-cron.js";
import { scheduleNonceCleanup } from "./jobs/nonce-cleanup.js";
import { scheduleDepositRetry } from "./jobs/deposit-retry.js";
import { scheduleWrongNetworkRecovery } from "./jobs/deposit-recovery.js";
import { scheduleDepositNotifications } from "./jobs/deposit-notifications.js";
import { generateCorrelationId } from "./tracing.js";
import { reloadModelCatalog } from "./inference/models.js";
import {
  startBackgroundDbSync,
  startBackgroundProbing,
  startCacheCleanup,
  stopBackgroundDbSync,
  stopBackgroundProbing,
  stopCacheCleanup,
} from "./inference/provider-health.js";
import { stopQueueProcessor } from "./lib/request-queue.js";
import { initProviderResultReporter } from "./inference/provider-result.js";

reloadModelCatalog();

if (config.NODE_ENV !== "test") {
  initProviderResultReporter();
  startBackgroundDbSync();
  startBackgroundProbing();
  startCacheCleanup();
  scheduleCreditExpiry();
  scheduleSubscriptionCheck();
  scheduleNonceCleanup();
  scheduleDepositRetry();
  scheduleWrongNetworkRecovery();
  scheduleDepositNotifications();
}

const app = new Hono<OmaEnv>();

app.use("*", async (c, next) => {
  const correlationId = c.req.header("X-Correlation-ID") || generateCorrelationId();
  c.set("correlationId", correlationId);
  c.header("X-Request-ID", correlationId);
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
  allowHeaders: ["Content-Type", "Authorization", "X-Houdini-Order-Id", "X-Houdini-Signature"],
  exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
  maxAge: 86400,
};

app.use("*", cors(corsOptions));

app.get("/health", async (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ status: "ok", version: "2.0.0", service: "oma-ai" }, 200);
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
app.route("/", withdrawalRoutes);
app.route("/", invoiceRoutes);
app.route("/", refundRoutes);
app.route("/", exportRoutes);

app.notFound((c) => c.json({ error: { message: `Route ${c.req.path} not found`, type: "not_found" } }, 404));

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
  return c.json({ error: { message: err.message, type: "client_error" } }, status);
});

const httpServer = createServer();

serve({
  fetch: app.fetch,
  port: config.PORT,
}, (info) => {
  logger.info({ port: info.port }, "[OMA] API server running");
  logger.info({ healthUrl: `http://localhost:${info.port}/health` }, "[OMA] Health endpoint");
  logger.info({ modelsUrl: `http://localhost:${info.port}/v1/models` }, "[OMA] Models endpoint");
  logger.info({ wsUrl: `ws://localhost:${info.port}/v1/chat/completions/ws` }, "[OMA] WebSocket endpoint");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "[OMA] Shutdown signal received, closing gracefully...");

    stopBackgroundDbSync();
    stopBackgroundProbing();
    stopCacheCleanup();
    stopQueueProcessor();

    httpServer.close(async () => {
      logger.info("[OMA] HTTP server closed");

      try {
        const { closeRedisClient } = await import("./lib/redis-client.js");
        await closeRedisClient();
        logger.info("[OMA] Redis connection closed");
      } catch (err) {
        logger.warn({ error: err }, "[OMA] Redis close error");
      }

      logger.info("[OMA] Graceful shutdown complete");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("[OMA] Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});

export default app;
