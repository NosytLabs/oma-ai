/**
 * Admin health + integrations status.
 */
import type { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { db } from "../../db/client.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";

export function registerHealthRoutes(app: Hono<OmaEnv>): void {
app.get("/v1/admin/integrations", async (c) => {
  const polarConfigured =
    !!config.POLAR_ACCESS_TOKEN &&
    !config.POLAR_ACCESS_TOKEN.includes("...");
  const omaAiConfigured = !!config.ZYLOO_API_KEY;
  const veniceConfigured = !!config.VENICE_API_KEY;
  const PLACEHOLDER_SUBSTRINGS = ["...", "placeholder", "change-me", "YOUR_", "PASTE"];
  const resendConfigured =
    !!config.RESEND_API_KEY &&
    !PLACEHOLDER_SUBSTRINGS.some((p) => config.RESEND_API_KEY!.includes(p));

  // Probe OpenBroker/OMA-AI live.
  // NOTE: GET /v1/models on openbroker returns a status envelope
  // ({status:"ok"}), NOT an OpenAI-style model list. Prefer /health for
  // liveness; treat non-ok as degraded.
  let omaAiHealth: {
    status: "healthy" | "degraded" | "down";
    latencyMs?: number;
    note?: string;
    supportedModels?: string[];
  } = { status: "down" };
  if (omaAiConfigured) {
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      // /health is the real liveness endpoint; /v1/models is a status stub.
      const r = await fetch(`${config.ZYLOO_API_URL}/health`, {
        headers: { Authorization: `Bearer ${config.ZYLOO_API_KEY}` },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const body = await r.text().catch(() => "");
      let statusOk = r.ok;
      try {
        const j = JSON.parse(body) as { status?: string };
        if (j.status && j.status !== "ok") statusOk = false;
      } catch {
        /* non-JSON is fine if HTTP ok */
      }
      omaAiHealth = {
        status: statusOk ? "healthy" : "degraded",
        latencyMs: Date.now() - start,
        // Live OpenBroker catalog (verified via chat error + probes 2026-08-04)
        supportedModels: ["gemini-3-flash-preview", "kimi-k3"],
        note: statusOk
          ? "OpenBroker reachable; model list is not exposed via /v1/models (status stub only)"
          : `upstream returned ${r.status}`,
      };
    } catch (err) {
      omaAiHealth = { status: "down", note: String((err as Error).message ?? err) };
    }
  } else {
    omaAiHealth = { status: "down", note: "ZYLOO_API_KEY not set" };
  }

  return c.json({
    polar: {
      configured: polarConfigured,
      server: config.POLAR_SERVER,
      organizationId: config.POLAR_ORGANIZATION_ID?.startsWith("org_...") ? null : config.POLAR_ORGANIZATION_ID,
      note: polarConfigured ? "Polar events will be sent" : "Set POLAR_ACCESS_TOKEN in server/.env to enable usage metering",
    },
    omaAi: {
      configured: omaAiConfigured,
      url: config.ZYLOO_API_URL,
      health: omaAiHealth,
    },
    venice: {
      configured: veniceConfigured,
      url: config.VENICE_API_URL,
      private: !config.OMMA_ALLOW_NON_PRIVATE_VENICE,
    },
    resend: {
      configured: resendConfigured,
      from: config.RESEND_FROM,
    },
    node_env: config.NODE_ENV,
    dailyLimits: {
      anonymous: 20,
      registered: 100,
    },
  });
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get("/v1/admin/health", async (c) => {
  const uptime = process.uptime();
  const used = process.memoryUsage();
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (err) {
    logger.warn({ err }, "admin/health db ping failed");
  }
  return c.json({
    status: "ok",
    version: "2.1.0",
    env: config.NODE_ENV,
    uptime_s: Math.round(uptime),
    memory: {
      rss_mb: Math.round(used.rss / 1024 / 1024),
      heap_used_mb: Math.round(used.heapUsed / 1024 / 1024),
    },
    db: dbOk ? "reachable" : "down",
    timestamp: new Date().toISOString(),
  });
});

}
