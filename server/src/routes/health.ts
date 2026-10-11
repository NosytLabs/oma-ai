import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { redisHealthCheck } from "../lib/redis-client.js";
import { logger } from "../lib/logger.js";

export const healthRoutes = new Hono<OmaEnv>();

healthRoutes.get("/health", async (c) => {
  // Public endpoint: no version/env fingerprinting (recon hardening).
  return c.json({
    status: "ok",
    service: "oma-ai",
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get("/health/db", async (c) => {
  try {
    await db.execute(sql`select 1`);
    return c.json({ status: "ok", db: "reachable" });
  } catch (err) {
    logger.error({ err }, "[health] database health check failed");
    return c.json(
      { status: "error", db: "unreachable" },
      503,
    );
  }
});

/**
 * Readiness probe with dependency check map for the dashboard health widgets.
 * Keep payload small: operators and k8s only need status + latency.
 */
healthRoutes.get("/ready", async (c) => {
  const checks: Record<
    string,
    { ok: boolean; status: string; latencyMs?: number; error?: string }
  > = {};

  const dbStart = Date.now();
  try {
    await db.execute(sql`select 1`);
    checks.database = {
      ok: true,
      status: "ok",
      latencyMs: Date.now() - dbStart,
    };
  } catch (err) {
    // SECURITY: /ready is public. Keep the raw driver message in the logs.
    logger.error({ err }, "[health] database readiness check failed");
    checks.database = {
      ok: false,
      status: "outage",
      latencyMs: Date.now() - dbStart,
    };
  }

  try {
    const redis = await redisHealthCheck();
    const redisOk = redis.status === "ok" || redis.status === "not_configured";
    checks.redis = {
      ok: redisOk,
      status: redisOk ? "ok" : "degraded",
      latencyMs: redis.latency,
      error: redisOk ? undefined : redis.status,
    };
  } catch (err) {
    // SECURITY: /ready is public. Keep the raw driver message in the logs.
    logger.error({ err }, "[health] redis readiness check failed");
    checks.redis = {
      ok: false,
      status: "degraded",
    };
  }

  const ready = Object.values(checks).every((c) => c.ok);
  return c.json(
    {
      status: ready ? "ready" : "not_ready",
      service: "oma-ai",
      uptimeSec: Math.floor(process.uptime()),
      checks,
    },
    ready ? 200 : 503,
  );
});

healthRoutes.get("/live", (c) => c.json({ status: "live" }));

healthRoutes.get("/version", (c) =>
  c.json({ version: "2.1.0", service: "oma-ai" }),
);
