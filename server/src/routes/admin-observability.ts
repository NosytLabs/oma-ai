// Admin observability endpoints. All require session auth + admin role.
// Provides aggregate views over deposits, subscriptions, credits, and queue.

import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import type { OmaEnv } from "../types.js";
import { sessionAuth, requireAdmin } from "../auth/middleware.js";

export const adminObservabilityRoutes = new Hono<OmaEnv>();

// Note: Only /v1/admin/* paths defined here. The /admin/* prefix is served by
// routes/admin/*.ts (mounted earlier at app.route("/", adminRoutes)) which has
// the correct response shape for the frontend admin page. Duplicating /admin/*
// here would shadow those routes and return a different shape (e.g. /admin/usage
// returns { window, totals } instead of { period, summary }).
adminObservabilityRoutes.use("/v1/admin/*", sessionAuth);
adminObservabilityRoutes.use("/v1/admin/*", requireAdmin());

// GET /v1/admin/usage?days=30
adminObservabilityRoutes.on("GET", "/v1/admin/usage", async (c) => {
  const days = Math.min(parseInt(c.req.query("days") ?? "30"), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    // Run the 4 independent aggregations in parallel instead of serially.
    // Per-row latency: 4 queries × ~10-30ms p50 = 40-120ms sequential;
    // with Promise.all: ~10-30ms (slowest of the set).
    const [totals, byProvider, byModel, byDay] = await Promise.all([
      db.execute(sql`SELECT
        COALESCE(SUM(input_tokens), 0)::int AS total_input_tokens,
        COALESCE(SUM(output_tokens), 0)::int AS total_output_tokens,
        COALESCE(SUM(total_cents), 0)::numeric AS total_cents,
        COUNT(*)::int AS request_count,
        COUNT(DISTINCT user_id)::int AS active_users
      FROM usage_records WHERE created_at >= ${since}`),
      db.execute(sql`SELECT
        provider, COUNT(*)::int AS requests,
        COALESCE(SUM(input_tokens), 0)::int AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::int AS output_tokens,
        COALESCE(SUM(total_cents), 0)::numeric AS total_cents
      FROM usage_records WHERE created_at >= ${since}
      GROUP BY provider ORDER BY SUM(total_cents) DESC`),
      db.execute(sql`SELECT
        model, COUNT(*)::int AS requests,
        COALESCE(SUM(total_cents), 0)::numeric AS total_cents
      FROM usage_records WHERE created_at >= ${since}
      GROUP BY model ORDER BY SUM(total_cents) DESC LIMIT 20`),
      db.execute(sql`SELECT
        date_trunc('day', created_at) AS day,
        COUNT(*)::int AS requests,
        COALESCE(SUM(total_cents), 0)::numeric AS total_cents
      FROM usage_records WHERE created_at >= ${since}
      GROUP BY day ORDER BY day DESC LIMIT 30`),
    ]);

    return c.json({
      window: { days, since: since.toISOString() },
      totals: (totals as { rows?: Array<Record<string, unknown>> }).rows?.[0] ?? {},
      byProvider: (byProvider as { rows?: unknown[] }).rows ?? [],
      byModel: (byModel as { rows?: unknown[] }).rows ?? [],
      byDay: (byDay as { rows?: unknown[] }).rows ?? [],
    });
  } catch (err) {
    return c.json({ error: { message: (err as Error).message, type: "server_error" } }, 500);
  }
});

// GET /v1/admin/deposits?limit=50&status=confirmed
adminObservabilityRoutes.on("GET", "/v1/admin/deposits", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 500);
  const status = c.req.query("status");
  try {
    const r = status
      ? await db.execute(sql`SELECT id, user_id, type, status, token_symbol, amount, amount_usd_cents, tx_hash, from_address, credited_at, created_at FROM deposits WHERE status = ${status}::deposit_status ORDER BY created_at DESC LIMIT ${limit}`)
      : await db.execute(sql`SELECT id, user_id, type, status, token_symbol, amount, amount_usd_cents, tx_hash, from_address, credited_at, created_at FROM deposits ORDER BY created_at DESC LIMIT ${limit}`);
    return c.json({
      deposits: (r as { rows?: unknown[] }).rows ?? [],
      count: ((r as { rows?: unknown[] }).rows ?? []).length,
    });
  } catch (err) {
    return c.json({ error: { message: (err as Error).message, type: "server_error" } }, 500);
  }
});

// GET /v1/admin/deposits/stats
adminObservabilityRoutes.on("GET", "/v1/admin/deposits/stats", async (c) => {
  try {
    const r = await db.execute(sql`SELECT
        status, type,
        COUNT(*)::int AS count,
        COALESCE(SUM(amount_usd_cents), 0)::int AS total_usd_cents
      FROM deposits GROUP BY status, type ORDER BY status, type`);
    return c.json({ stats: (r as { rows?: unknown[] }).rows ?? [] });
  } catch (err) {
    return c.json({ error: { message: (err as Error).message, type: "server_error" } }, 500);
  }
});

// GET /v1/admin/credit-balances?limit=50
adminObservabilityRoutes.on("GET", "/v1/admin/credit-balances", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 500);
  try {
    const r = await db.execute(sql`SELECT cb.user_id, u.address, cb.credits, cb.lifetime_credits, cb.last_credited_at, cb.created_at
      FROM credit_balances cb JOIN users u ON cb.user_id = u.id
      ORDER BY cb.credits DESC LIMIT ${limit}`);
    return c.json({
      balances: (r as { rows?: unknown[] }).rows ?? [],
      count: ((r as { rows?: unknown[] }).rows ?? []).length,
    });
  } catch (err) {
    return c.json({ error: { message: (err as Error).message, type: "server_error" } }, 500);
  }
});

// GET /v1/admin/subscriptions?limit=50
adminObservabilityRoutes.on("GET", "/v1/admin/subscriptions", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 500);
  try {
    const r = await db.execute(sql`SELECT s.id, s.user_id, u.address, s.plan_id, p.name AS plan_name, s.status, s.current_period_start, s.current_period_end, s.created_at
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      JOIN plans p ON s.plan_id = p.id
      ORDER BY s.created_at DESC LIMIT ${limit}`);
    return c.json({
      subscriptions: (r as { rows?: unknown[] }).rows ?? [],
      count: ((r as { rows?: unknown[] }).rows ?? []).length,
    });
  } catch (err) {
    return c.json({ error: { message: (err as Error).message, type: "server_error" } }, 500);
  }
});

// GET /v1/admin/circuit-breaker
adminObservabilityRoutes.on("GET", "/v1/admin/circuit-breaker", async (c) => {
  try {
    const r = await db.execute(sql`SELECT provider, is_up, consecutive_failures, avg_latency_ms, last_success_at, last_failure_at, updated_at FROM provider_health ORDER BY provider`);
    return c.json({
      providers: (r as { rows?: unknown[] }).rows ?? [],
      count: ((r as { rows?: unknown[] }).rows ?? []).length,
    });
  } catch (err) {
    return c.json({ error: { message: (err as Error).message, type: "server_error" } }, 500);
  }
});

// GET /v1/admin/dlq
adminObservabilityRoutes.on("GET", "/v1/admin/dlq", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 200);
  try {
    const { getDlqEntries, getSettlementDlqEntries, getSettlementDlqLength } = await import("../lib/dlq.js");
    const [webhook, settlement] = await Promise.all([
      getDlqEntries(0, limit).catch(() => []),
      getSettlementDlqEntries(0, limit).catch(() => []),
    ]);
    return c.json({
      webhook: { entries: webhook, count: webhook.length },
      settlement: { entries: settlement, count: settlement.length },
      settlementLength: await getSettlementDlqLength().catch(() => 0),
    });
  } catch (err) {
    return c.json({ error: { message: (err as Error).message, type: "server_error" } }, 500);
  }
});

// GET /v1/admin/oracle-prices
adminObservabilityRoutes.on("GET", "/v1/admin/oracle-prices", async (c) => {
  try {
    const r = await db.execute(sql`SELECT token_symbol, price_usd, source, fetched_at FROM oracle_prices ORDER BY fetched_at DESC LIMIT 50`);
    return c.json({
      prices: (r as { rows?: unknown[] }).rows ?? [],
      count: ((r as { rows?: unknown[] }).rows ?? []).length,
    });
  } catch (err) {
    return c.json({ error: { message: (err as Error).message, type: "server_error" } }, 500);
  }
});
