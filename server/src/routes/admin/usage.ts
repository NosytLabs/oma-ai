/**
 * Admin usage analytics routes.
 */
import type { Hono } from "hono";
import { sql, desc, eq, gte, count } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { db } from "../../db/client.js";
import { usageRecords } from "../../db/schema.js";
import { logger } from "../../lib/logger.js";

export function registerUsageRoutes(app: Hono<OmaEnv>): void {
app.get("/v1/admin/usage", async (c) => {
  const window = (c.req.query("window") ?? "7d").toLowerCase();
  const days = window === "24h" ? 1 : window === "30d" ? 30 : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const [totals] = await db
      .select({
        requests: count(),
        inputTokens: sql<number>`COALESCE(SUM(${usageRecords.inputTokens}), 0)::int`,
        outputTokens: sql<number>`COALESCE(SUM(${usageRecords.outputTokens}), 0)::int`,
        costCents: sql<number>`COALESCE(SUM(${usageRecords.costCents}::numeric), 0)::float`,
        markupCents: sql<number>`COALESCE(SUM(${usageRecords.markupCents}::numeric), 0)::float`,
        totalCents: sql<number>`COALESCE(SUM(${usageRecords.totalCents}::numeric), 0)::float`,
      })
      .from(usageRecords)
      .where(gte(usageRecords.createdAt, since));

    // Per-model breakdown
    const perModel = await db
      .select({
        model: usageRecords.model,
        provider: usageRecords.provider,
        requests: count(),
        inputTokens: sql<number>`COALESCE(SUM(${usageRecords.inputTokens}), 0)::int`,
        outputTokens: sql<number>`COALESCE(SUM(${usageRecords.outputTokens}), 0)::int`,
        totalCents: sql<number>`COALESCE(SUM(${usageRecords.totalCents}::numeric), 0)::float`,
      })
      .from(usageRecords)
      .where(gte(usageRecords.createdAt, since))
      .groupBy(usageRecords.model, usageRecords.provider)
      .orderBy(sql`SUM(${usageRecords.totalCents}::numeric) DESC`)
      .limit(20);

    return c.json({
      window,
      since: since.toISOString(),
      totals: {
        requests: Number(totals?.requests ?? 0),
        inputTokens: Number(totals?.inputTokens ?? 0),
        outputTokens: Number(totals?.outputTokens ?? 0),
        costCents: Number(totals?.costCents ?? 0),
        markupCents: Number(totals?.markupCents ?? 0),
        totalCents: Number(totals?.totalCents ?? 0),
      },
      perModel: perModel.map((m) => ({
        model: m.model,
        provider: m.provider,
        requests: Number(m.requests),
        inputTokens: Number(m.inputTokens),
        outputTokens: Number(m.outputTokens),
        totalCents: Number(m.totalCents),
      })),
    });
  } catch (err) {
    logger.error({ err }, "[admin/usage] query failed");
    return c.json({ error: { message: "usage query failed", type: "server_error" } }, 500);
  }
});

app.get("/v1/admin/usage/recent", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? "50"), 200);
  const filterUserId = c.req.query("userId")?.trim();
  try {
    let query = db
      .select({
        id: usageRecords.id,
        requestId: usageRecords.requestId,
        userId: usageRecords.userId,
        model: usageRecords.model,
        provider: usageRecords.provider,
        inputTokens: usageRecords.inputTokens,
        outputTokens: usageRecords.outputTokens,
        costCents: usageRecords.costCents,
        totalCents: usageRecords.totalCents,
        status: usageRecords.status,
        createdAt: usageRecords.createdAt,
      })
      .from(usageRecords);

    if (filterUserId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = query.where(eq(usageRecords.userId, filterUserId)) as any;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (query.orderBy(desc(usageRecords.createdAt)).limit(limit) as any);
    return c.json({ data: rows, count: rows.length });
  } catch (err) {
    logger.error({ err }, "[admin/usage/recent] failed");
    return c.json({ error: { message: "usage query failed", type: "server_error" } }, 500);
  }
});

}
