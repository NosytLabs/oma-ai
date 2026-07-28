import { Hono } from "hono";
import { db } from "../../db/client.js";
import { usageRecords, users, creditBalances } from "../../db/schema.js";
import { desc, sql, count, eq } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { logger } from "../../lib/logger.js";

export const usageRoutes = new Hono<OmaEnv>();

usageRoutes.get("/admin/usage", async (c) => {
  const period = c.req.query("period") || "30d";
  if (!["7d", "30d", "90d"].includes(period)) {
    return c.json({ error: { message: "Invalid period. Must be 7d, 30d, or 90d", type: "invalid_request_error" } }, 400);
  }
  
  let dateFilter: Date;
  const now = new Date();
  switch (period) {
    case "7d":
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  try {
    const [aggregateUsage, byProvider, byModel, dailyUsage] = await Promise.all([
      db.select({
        totalRequests: count(usageRecords.id),
        totalInputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
        totalOutputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
        totalRevenueCents: sql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
        totalCostCents: sql<number>`coalesce(sum(${usageRecords.costCents}), 0)`,
      })
      .from(usageRecords)
      .where(sql`${usageRecords.createdAt} >= ${dateFilter}`),
      
      db.select({
        provider: usageRecords.provider,
        totalRequests: count(usageRecords.id),
        totalInputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
        totalOutputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
        totalRevenueCents: sql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
        totalCostCents: sql<number>`coalesce(sum(${usageRecords.costCents}), 0)`,
      })
      .from(usageRecords)
      .where(sql`${usageRecords.createdAt} >= ${dateFilter}`)
      .groupBy(usageRecords.provider),
      
      db.select({
        model: usageRecords.model,
        provider: usageRecords.provider,
        totalRequests: count(usageRecords.id),
        totalInputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
        totalOutputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
        totalRevenueCents: sql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      })
      .from(usageRecords)
      .where(sql`${usageRecords.createdAt} >= ${dateFilter}`)
      .groupBy(usageRecords.model, usageRecords.provider)
      .orderBy(desc(sql`sum(${usageRecords.totalCents})`))
      .limit(20),
      
      db.select({
        date: sql<string>`date(${usageRecords.createdAt})`,
        totalRequests: count(usageRecords.id),
        totalRevenueCents: sql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      })
      .from(usageRecords)
      .where(sql`${usageRecords.createdAt} >= ${dateFilter}`)
      .groupBy(sql`date(${usageRecords.createdAt})`)
      .orderBy(sql`date(${usageRecords.createdAt})`),
    ]);

    const agg = aggregateUsage[0];
    return c.json({
      period,
      summary: {
        totalRequests: Number(agg?.totalRequests || 0),
        totalInputTokens: Number(agg?.totalInputTokens || 0),
        totalOutputTokens: Number(agg?.totalOutputTokens || 0),
        totalRevenue: Number(agg?.totalRevenueCents || 0) / 100,
        totalCost: Number(agg?.totalCostCents || 0) / 100,
        grossProfit: (Number(agg?.totalRevenueCents || 0) - Number(agg?.totalCostCents || 0)) / 100,
        margin: agg?.totalCostCents && Number(agg.totalCostCents) > 0 
          ? ((Number(agg.totalRevenueCents) - Number(agg.totalCostCents)) / Number(agg.totalRevenueCents) * 100).toFixed(1) + "%"
          : "N/A",
      },
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        totalRequests: Number(p.totalRequests),
        totalInputTokens: Number(p.totalInputTokens),
        totalOutputTokens: Number(p.totalOutputTokens),
        totalRevenue: Number(p.totalRevenueCents) / 100,
        totalCost: Number(p.totalCostCents) / 100,
        profit: (Number(p.totalRevenueCents) - Number(p.totalCostCents)) / 100,
      })),
      byModel: byModel.map((m) => ({
        model: m.model,
        provider: m.provider,
        totalRequests: Number(m.totalRequests),
        totalInputTokens: Number(m.totalInputTokens),
        totalOutputTokens: Number(m.totalOutputTokens),
        totalRevenue: Number(m.totalRevenueCents) / 100,
      })),
      dailyUsage: dailyUsage.map((d) => ({
        date: d.date,
        totalRequests: Number(d.totalRequests),
        totalRevenue: Number(d.totalRevenueCents) / 100,
      })),
    });
  } catch (err) {
    logger.error({ err, period }, "Admin usage error");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

/**
 * GET /admin/usage/top-users?period=30d&limit=10
 *
 * Returns the top-N users by total cost over the period, joined with the
 * users + creditBalances tables for display fields. Designed for the admin
 * overview "biggest spenders" card so the operator can spot whales and
 * investigate failed-payment cases.
 */
usageRoutes.get("/admin/usage/top-users", async (c) => {
  const period = c.req.query("period") || "30d";
  const limit = Math.min(parseInt(c.req.query("limit") ?? "10"), 100);
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const rows = await db.select({
      userId: usageRecords.userId,
      address: users.address,
      accountNumber: users.accountNumber,
      totalRequests: count(usageRecords.id),
      totalInputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
      totalRevenueCents: sql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      lastActivityAt: creditBalances.lastActivityAt,
      balanceCents: creditBalances.balanceCents,
    })
    .from(usageRecords)
    .innerJoin(users, eq(users.id, usageRecords.userId))
    .leftJoin(creditBalances, eq(creditBalances.userId, usageRecords.userId))
    .where(sql`${usageRecords.createdAt} >= ${since}`)
    .groupBy(usageRecords.userId, users.address, users.accountNumber, creditBalances.lastActivityAt, creditBalances.balanceCents)
    .orderBy(desc(sql`sum(${usageRecords.totalCents})`))
    .limit(limit);

    return c.json({
      period,
      topUsers: rows.map((r) => ({
        userId: r.userId,
        address: r.address,
        accountNumber: r.accountNumber,
        totalRequests: Number(r.totalRequests),
        totalInputTokens: Number(r.totalInputTokens),
        totalOutputTokens: Number(r.totalOutputTokens),
        totalRevenue: Number(r.totalRevenueCents) / 100,
        balanceDollars: Number(r.balanceCents ?? 0) / 100,
        lastActivityAt: r.lastActivityAt,
      })),
    });
  } catch (err) {
    logger.error({ err, period }, "Admin top-users error");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

/**
 * GET /admin/usage/model-popularity?period=30d&limit=10
 *
 * Returns the most-requested models in the period, ordered by request count
 * (not cost) so operators can see what's actually being used. Powers the
 * admin "Model Popularity Ranking" card.
 */
usageRoutes.get("/admin/usage/model-popularity", async (c) => {
  const period = c.req.query("period") || "30d";
  const limit = Math.min(parseInt(c.req.query("limit") ?? "10"), 100);
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const rows = await db.select({
      model: usageRecords.model,
      provider: usageRecords.provider,
      requests: count(usageRecords.id),
      uniqueUsers: sql<number>`count(distinct ${usageRecords.userId})`,
      totalRevenueCents: sql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      successCount: sql<number>`sum(case when ${usageRecords.status} = 'success' then 1 else 0 end)`,
      errorCount: sql<number>`sum(case when ${usageRecords.status} != 'success' and ${usageRecords.status} is not null then 1 else 0 end)`,
    })
    .from(usageRecords)
    .where(sql`${usageRecords.createdAt} >= ${since}`)
    .groupBy(usageRecords.model, usageRecords.provider)
    .orderBy(desc(count(usageRecords.id)))
    .limit(limit);

    return c.json({
      period,
      models: rows.map((r) => ({
        model: r.model,
        provider: r.provider,
        requests: Number(r.requests),
        uniqueUsers: Number(r.uniqueUsers),
        totalRevenue: Number(r.totalRevenueCents) / 100,
        successCount: Number(r.successCount ?? 0),
        errorCount: Number(r.errorCount ?? 0),
        errorRate: Number(r.requests) > 0
          ? Number((Number(r.errorCount ?? 0) / Number(r.requests) * 100).toFixed(2))
          : 0,
      })),
    });
  } catch (err) {
    logger.error({ err, period }, "Admin model-popularity error");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});