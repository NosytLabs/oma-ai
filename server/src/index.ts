import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { config } from "./config.js";
import { securityHeaders } from "./middleware/security.js";
import { logger } from "./lib/logger.js";
import { authRoutes } from "./routes/auth.js";
import { initAuth } from "./auth/middleware.js";
import { chatRoutes } from "./routes/chat/index.js";
import { modelRoutes } from "./routes/models.js";
import { depositRoutes } from "./routes/deposit/index.js";
import { searchRoutes } from "./routes/search.js";
import { x402Routes } from "./x402/facilitator.js";
import { onrampRoutes } from "./routes/onramp.js";
import { creditRoutes } from "./routes/credits.js";
import { adminRoutes } from "./routes/admin/index.js";
import { configRoutes } from "./routes/config.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { adminAnalyticsRoutes } from "./routes/analytics-admin.js";
import { fetchRoutes } from "./routes/fetch.js";
import { withdrawalRoutes } from "./routes/withdraw.js";
import { refundRoutes } from "./routes/refunds.js";
import { exportRoutes } from "./routes/export.js";
import { healthRoutes } from "./routes/health.js";
import { metricsRoutes, metricsMiddleware } from "./routes/metrics.js";
import { openapiRoutes } from "./routes/openapi.js";
import { providersMetaRoutes } from "./routes/providers-meta.js";
import { usageRoutes } from "./routes/usage.js";
import { adminObservabilityRoutes } from "./routes/admin-observability.js";
import { logRoutes } from "./routes/log.js";
import { missingRoutes } from "./routes/missing-routes.js";
import { networkRoutes } from "./routes/network.js";
import type { OmaEnv } from "./types.js";
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

import { triggerRefresh as triggerCheapTokensRefresh } from "./inference/cheaptokens.js";

reloadModelCatalog();

// External cron jobs (moved to .github/workflows/* to allow NEON scale-to-zero).
// The work functions are still exported from each module so existing unit tests
// can call them directly.
//   credit-expiry          → .github/workflows/credit-expiry.yml          (daily)
//   subscription-check     → .github/workflows/subscription-check.yml     (hourly)
//   nonce-cleanup          → .github/workflows/nonce-cleanup.yml          (every 15m)
//   deposit-retry          → .github/workflows/deposit-retry.yml          (every 5m)
//   deposit-recovery       → .github/workflows/wrong-network-recovery.yml (every 5m)
//   deposit-notifications  → .github/workflows/deposit-notifications.yml   (every 5m)
//   retention              → .github/workflows/retention.yml              (daily 03:00 UTC)
//
// In-process tasks that MUST stay here (real-time, no external trigger is
// fast enough to drive them):
//   - startBackgroundDbSync       : syncs circuit-breaker state Redis → DB every 30s
//   - startBackgroundProbing       : probes idle providers in real time
//   - startCacheCleanup            : clears stale circuit-breaker in-memory cache
//   - triggerCheapTokensRefresh    : one-shot initial refresh on cold start
//   - reloadModelCatalog           : one-shot model catalog load on cold start
//   - initProviderResultReporter   : one-shot result-reporter init
// Moving these to GH Actions would break the circuit breaker (the breaker
// is in-process and must be driven in the same process that holds it).
// The schedule*() helpers in each job module are kept (not called) so
// existing tests can still instantiate intervals in isolation.

if (config.CORS_ORIGIN === "*" && config.NODE_ENV === "production") {
  logger.fatal("[SECURITY] CORS_ORIGIN='*' is not allowed in production. Refusing to start. Set specific origins (comma-separated).");
  process.exit(1);
}

// H5: Fail fast on missing or weak CSRF_SECRET. generateCsrfToken() throws if
// CSRF_SECRET is unset, but that function is only called when a user requests
// a CSRF token — failing at startup is safer. In dev/test the zod default
// (≥32 chars) is acceptable.
if (config.NODE_ENV === "production" && (!config.CSRF_SECRET || config.CSRF_SECRET.length < 32)) {
  const msg = config.CSRF_SECRET
    ? `CSRF_SECRET length is ${config.CSRF_SECRET.length} (minimum 32).`
    : "CSRF_SECRET is not set.";
  logger.fatal(`[SECURITY] ${msg} Refusing to start.`);
  process.exit(1);
}

// Fail-fast auth validation (admin addresses). Runs at startup, not at module
// import, so test imports of the auth middleware don't exit the process.
initAuth();

if (config.NODE_ENV !== "test") {
  startBackgroundDbSync();
  startBackgroundProbing();
  startCacheCleanup();
  triggerCheapTokensRefresh().catch((err) => {
    logger.warn({ error: (err as Error).message }, "[cheaptokens] initial refresh failed");
  });
}

const app = new Hono<OmaEnv>();

app.use("*", async (c, next) => {
  const correlationId = c.req.header("X-Correlation-ID") || generateCorrelationId();
  c.set("correlationId", correlationId);
  c.header("X-Request-ID", correlationId);
  await next();
});

// C10: Add response compression — reduces API response sizes by 3-10x
app.use("*", compress());

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
  allowHeaders: ["Content-Type", "Authorization", "PAYMENT-SIGNATURE", "PAYMENT-REQUIRED"],
  exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
  maxAge: 86400,
};

app.use("*", cors(corsOptions));

// Count every HTTP request for /metrics (mount before all routes)
app.use("*", metricsMiddleware);

// Public operational routes (no auth) — MUST be mounted before any auth-protected
// sub-router that uses a `*` wildcard, so probes/ping/metrics/openapi are not
// shadowed by 401s. The inline `app.get("/health")` previously in this file
// was a stub that did not touch the DB; the full /health + /ready + /live +
// /version set lives in routes/health.ts. See docs/archive/audit-2026-06-13v2/backend.md
// S-NEW-1 (23 orphan endpoints before this fix).
app.route("/", healthRoutes);
app.route("/", metricsRoutes);
app.route("/", openapiRoutes);
app.route("/", providersMetaRoutes);
app.route("/", usageRoutes);

app.route("/", authRoutes);
app.route("/", chatRoutes);
app.route("/", modelRoutes);
app.route("/", depositRoutes);
app.route("/", searchRoutes);
app.route("/", x402Routes);
app.route("/", onrampRoutes);
app.route("/", creditRoutes);
app.route("/", adminRoutes);
app.route("/", missingRoutes);
app.route("/", configRoutes);
app.route("/", analyticsRoutes);
app.route("/", adminAnalyticsRoutes);
app.route("/", fetchRoutes);
app.route("/", withdrawalRoutes);
app.route("/", refundRoutes);
app.route("/", exportRoutes);
// Network primitives — audit stream, rate-limit inspection, signing pin,
// upstream health, and the live deposit feed WebSocket.
app.route("/", networkRoutes);

// Admin observability — must be mounted under /v1/admin path so its internal
// `.use("/admin/*", sessionAuth)` / `.use("/v1/admin/*", sessionAuth)` wildcards
// only match admin paths and don't shadow other routes. Router defines its own
// path prefixes internally.
app.route("/", adminObservabilityRoutes);
app.route("/", logRoutes);

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
  // Only expose err.message to clients for known-safe 4xx statuses (L3).
  // Any other status (including unknown 4xx) could leak internals like DB
  // driver errors or stack traces via err.message.
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

const shutdown = async (signal: string) => {
  logger.info({ signal }, "[OMA] Shutdown signal received, closing gracefully...");

  stopBackgroundDbSync();
  stopBackgroundProbing();
  stopCacheCleanup();

  server.close(async () => {
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

// Register shutdown handlers only in non-test environments. Tests that import
// `app` from this module trigger the module-level serve() which creates an HTTP
// server, but vitest's mock cleanup can leave `server` undefined when the
// shutdown handler fires during teardown, causing unhandled rejections.
if (config.NODE_ENV !== "test") {
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

export default app;
