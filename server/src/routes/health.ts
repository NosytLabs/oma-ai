import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { redisHealthCheck } from "../lib/redis-client.js";

export const healthRoutes = new Hono<OmaEnv>();

healthRoutes.get("/health", async (c) => {
  return c.json({
    status: "ok",
    service: "oma-ai",
    version: "2.1.0",
    timestamp: new Date().toISOString(),
    env: config.NODE_ENV,
  });
});

healthRoutes.get("/health/db", async (c) => {
  try {
    await db.execute(sql`select 1`);
    return c.json({ status: "ok", db: "reachable" });
  } catch (err) {
    return c.json(
      { status: "error", db: "unreachable", error: (err as Error).message },
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
    checks.database = {
      ok: false,
      status: "outage",
      latencyMs: Date.now() - dbStart,
      error: err instanceof Error ? err.message : "db unreachable",
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
    checks.redis = {
      ok: false,
      status: "degraded",
      error: err instanceof Error ? err.message : "redis check failed",
    };
  }

  const ready = Object.values(checks).every((c) => c.ok);
  return c.json(
    {
      status: ready ? "ready" : "not_ready",
      service: "oma-ai",
      version: "2.1.0",
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
