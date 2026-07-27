// Per-user usage analytics. Returns aggregated usage over a time window.
// Authenticated via session or API key.

import { Hono } from "hono";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { usageRecords } from "../db/schema.js";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";

export const usageRoutes = new Hono<OmaEnv>();

// GET /v1/usage?days=30
// sessionOrBearerAuth (not sessionAuth): the OpenAPI spec has always
// advertised BearerAuth here, but API-key callers got 401s.
usageRoutes.get("/v1/usage", sessionOrBearerAuth, async (c) => {
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
// Field names match the frontend UsageRecord DTO (promptTokens /
// completionTokens / costCents…) — the old inputTokens/outputTokens names
// silently rendered $0 costs and crashed the dashboard table.
usageRoutes.get("/v1/usage/recent", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: { message: "Unauthorized", type: "auth_error" } }, 401);
  const limit = Math.min(parseInt(c.req.query("limit") ?? "20"), 500);

  try {
    const r = await db.select({
      id: usageRecords.id,
      requestId: usageRecords.requestId,
      model: usageRecords.model,
      provider: usageRecords.provider,
      promptTokens: usageRecords.inputTokens,
      completionTokens: usageRecords.outputTokens,
      costCents: usageRecords.costCents,
      markupCents: usageRecords.markupCents,
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

// GET /v1/generation?id=gen-<requestId> — OpenRouter-style per-generation
// audit lookup. Accepts the id with or without the `gen-` prefix; scoped to
// the authenticated user.
usageRoutes.get("/v1/generation", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: { message: "Unauthorized", type: "auth_error" } }, 401);
  const rawId = c.req.query("id") ?? "";
  if (!rawId) return c.json({ error: { message: "id is required", type: "invalid_request_error" } }, 400);
  const requestId = rawId.startsWith("gen-") ? rawId.slice(4) : rawId;

  try {
    const rows = await db.select().from(usageRecords)
      .where(and(eq(usageRecords.requestId, requestId), eq(usageRecords.userId, userId)))
      .limit(1);
    if (rows.length === 0) {
      return c.json({ error: { message: "Generation not found", type: "not_found" } }, 404);
    }
    const rec = rows[0];
    return c.json({
      data: {
        id: `gen-${rec.requestId}`,
        model: rec.model,
        provider_name: rec.provider,
        tokens_prompt: rec.inputTokens,
        tokens_completion: rec.outputTokens,
        total_cost: parseFloat(rec.totalCents) / 100,
        cost_cents: rec.totalCents,
        upstream_cost_cents: rec.costCents,
        latency: rec.latencyMs,
        finish_reason: null,
        status: rec.status,
        created_at: rec.createdAt,
      },
    });
  } catch (err) {
    return c.json({ error: { message: (err as Error).message, type: "server_error" } }, 500);
  }
});
