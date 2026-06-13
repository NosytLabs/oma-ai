// Per-user usage analytics. Returns aggregated usage over a time window.
// Authenticated via session or API key.

import { Hono } from "hono";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { usageRecords } from "../db/schema.js";
import type { OmaEnv } from "../types.js";
import { sessionAuth } from "../auth/middleware.js";

export const usageRoutes = new Hono<OmaEnv>();

// GET /v1/usage?days=30
usageRoutes.get("/v1/usage", sessionAuth, async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: { message: "Unauthorized", type: "auth_error" } }, 401);

  const days = Math.min(parseInt(c.req.query("days") ?? "30"), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Run the 3 aggregations in parallel (totals / byModel / byProvider) instead of
    // sequentially. Same WHERE filter, so Postgres plans the same index scan 3x in
    // parallel; latency drops from ~3× single-query p50 to ~1× single-query p50.
    const [totals, byModel, byProvider] = await Promise.all([
      db.select({
        totalInputTokens: sql<number>`COALESCE(SUM(${usageRecords.inputTokens}), 0)::int`,
        totalOutputTokens: sql<number>`COALESCE(SUM(${usageRecords.outputTokens}), 0)::int`,
        totalCostCents: sql<number>`COALESCE(SUM(${usageRecords.totalCents}), 0)::numeric`,
        requestCount: sql<number>`count(*)::int`,
      }).from(usageRecords).where(and(eq(usageRecords.userId, userId), gte(usageRecords.createdAt, since))),
      db.select({
        model: usageRecords.model,
        requests: sql<number>`count(*)::int`,
        inputTokens: sql<number>`COALESCE(SUM(${usageRecords.inputTokens}), 0)::int`,
        outputTokens: sql<number>`COALESCE(SUM(${usageRecords.outputTokens}), 0)::int`,
        totalCents: sql<number>`COALESCE(SUM(${usageRecords.totalCents}), 0)::numeric`,
      }).from(usageRecords).where(and(eq(usageRecords.userId, userId), gte(usageRecords.createdAt, since)))
        .groupBy(usageRecords.model)
        .orderBy(sql`SUM(${usageRecords.totalCents}) DESC`)
        .limit(20),
      db.select({
        provider: usageRecords.provider,
        requests: sql<number>`count(*)::int`,
        inputTokens: sql<number>`COALESCE(SUM(${usageRecords.inputTokens}), 0)::int`,
        outputTokens: sql<number>`COALESCE(SUM(${usageRecords.outputTokens}), 0)::int`,
        totalCents: sql<number>`COALESCE(SUM(${usageRecords.totalCents}), 0)::numeric`,
      }).from(usageRecords).where(and(eq(usageRecords.userId, userId), gte(usageRecords.createdAt, since)))
        .groupBy(usageRecords.provider)
        .orderBy(sql`SUM(${usageRecords.totalCents}) DESC`),
    ]);

    return c.json({
      window: { days, since: since.toISOString() },
      totals: totals[0] ?? {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostCents: 0,
        requestCount: 0,
      },
      byModel,
      byProvider,
    });
  } catch (err) {
    return c.json({
      error: { message: (err as Error).message, type: "server_error" },
    }, 500);
  }
});

// GET /v1/usage/recent?limit=20
usageRoutes.get("/v1/usage/recent", sessionAuth, async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: { message: "Unauthorized", type: "auth_error" } }, 401);
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 100);

  try {
    const r = await db.select({
      id: usageRecords.id,
      model: usageRecords.model,
      provider: usageRecords.provider,
      inputTokens: usageRecords.inputTokens,
      outputTokens: usageRecords.outputTokens,
      totalCents: usageRecords.totalCents,
      latencyMs: usageRecords.latencyMs,
      status: usageRecords.status,
      createdAt: usageRecords.createdAt,
    }).from(usageRecords)
      .where(eq(usageRecords.userId, userId))
      .orderBy(sql`${usageRecords.createdAt} DESC`)
      .limit(limit);
    return c.json({ records: r, count: r.length });
  } catch (err) {
    return c.json({ error: { message: (err as Error).message, type: "server_error" } }, 500);
  }
});
