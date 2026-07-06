// Operational health + ping endpoints.
// /live  - is the process alive? (liveness probe)
// /ready - is the process ready to serve traffic? (readiness probe - pings DB + Redis)
// /health - alias for /ready with same payload (legacy + Docker HEALTHCHECK)
// /version - build/runtime metadata
// /ping, /v1/ping - cheap uptime-monitor endpoints

import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { SERVICE_VERSION } from "../constants.js";

export const healthRoutes = new Hono<OmaEnv>();

// ── Ping (uptime monitors) ────────────────────────────────────────────────
healthRoutes.get("/ping", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ pong: true, ts: Date.now() });
});
healthRoutes.get("/v1/ping", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ pong: true, ts: Date.now() });
});

const BUILD_SHA = process.env.BUILD_SHA ?? "dev";
const BUILD_TIME = process.env.BUILD_TIME ?? new Date().toISOString();
const START_TIME = new Date();

// Cheap, safe liveness probe: process is up and the event loop is responsive.
healthRoutes.get("/live", (c) => {
  return c.json({
    status: "ok",
    uptimeSec: Math.floor((Date.now() - START_TIME.getTime()) / 1000),
  });
});

// Readiness probe: verifies downstream dependencies (Neon DB) respond.
healthRoutes.get("/ready", async (c) => {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};
  let allOk = true;

  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (err) {
    const errMsg = process.env.NODE_ENV === "production"
      ? "database_connection_failed"
      : (err as Error).message;
    checks.database = { ok: false, error: errMsg };
    allOk = false;
  }

  // Redis is optional (in-memory rate-limit fallback works without it). Probe opportunistically.
  try {
    const { isRedisReady, redisHealthCheck } = await import("../lib/redis-client.js");
    if (isRedisReady()) {
      const result = await redisHealthCheck();
      checks.redis = { ok: result.status === "ok", latencyMs: result.latency };
    } else {
      checks.redis = { ok: true, error: "not_configured" };
    }
  } catch (err) {
    checks.redis = { ok: false, error: process.env.NODE_ENV === "production" ? "redis_connection_failed" : (err as Error).message };
    // Redis is best-effort; don't fail readiness.
  }

  return c.json(
    {
      status: allOk ? "ok" : "degraded",
      version: SERVICE_VERSION,
      service: "oma-ai",
      uptimeSec: Math.floor((Date.now() - START_TIME.getTime()) / 1000),
      checks,
    },
    allOk ? 200 : 503
  );
});

// Legacy /health alias - returns same payload as /ready (Docker HEALTHCHECK expects /health).
healthRoutes.get("/health", async (c) => {
  c.header("Cache-Control", "no-store");
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return c.json(
      {
        status: "ok",
        version: SERVICE_VERSION,
        service: "oma-ai",
        uptimeSec: Math.floor((Date.now() - START_TIME.getTime()) / 1000),
        dbLatencyMs: Date.now() - dbStart,
      },
      200
    );
  } catch (err) {
    return c.json(
      {
        status: "degraded",
        version: SERVICE_VERSION,
        service: "oma-ai",
        uptimeSec: Math.floor((Date.now() - START_TIME.getTime()) / 1000),
        error: process.env.NODE_ENV === "production" ? "database_connection_failed" : (err as Error).message,
      },
      503
    );
  }
});

// Build/runtime metadata. Safe to expose (no secrets).
healthRoutes.get("/version", (c) => {
  return c.json({
    service: "oma-ai",
    version: SERVICE_VERSION,
    buildSha: BUILD_SHA,
    buildTime: BUILD_TIME,
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    startedAt: START_TIME.toISOString(),
    uptimeSec: Math.floor((Date.now() - START_TIME.getTime()) / 1000),
  });
});
