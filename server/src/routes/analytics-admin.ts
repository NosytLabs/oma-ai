import { Hono } from "hono";
import { db } from "../db/client.js";
import { usageRecords, providerHealth, users } from "../db/schema.js";
import { desc, count, sql as drizzleSql } from "drizzle-orm";
import { sessionAuth, requireAdmin } from "../auth/middleware.js";
import type { OmaEnv } from "../types.js";

export const adminAnalyticsRoutes = new Hono<OmaEnv>();

adminAnalyticsRoutes.use("*", sessionAuth);
adminAnalyticsRoutes.use("*", requireAdmin());

adminAnalyticsRoutes.get("/v1/admin/analytics/overview", async (c) => {
  const period = c.req.query("period") || "30d";
  
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
    case "all":
      dateFilter = new Date(0);
      break;
    default:
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  try {
    const aggregateUsage = await db.select({
      totalRequests: count(usageRecords.id),
      totalInputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
      totalOutputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
      totalRevenueCents: drizzleSql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      totalCostCents: drizzleSql<number>`coalesce(sum(${usageRecords.costCents}), 0)`,
    })
    .from(usageRecords)
    .where(drizzleSql`${usageRecords.createdAt} >= ${dateFilter}`);

    const byProvider = await db.select({
      provider: usageRecords.provider,
      totalRequests: count(usageRecords.id),
      totalInputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
      totalOutputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
      totalRevenueCents: drizzleSql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      totalCostCents: drizzleSql<number>`coalesce(sum(${usageRecords.costCents}), 0)`,
    })
    .from(usageRecords)
    .where(drizzleSql`${usageRecords.createdAt} >= ${dateFilter}`)
    .groupBy(usageRecords.provider);

    const byModel = await db.select({
      model: usageRecords.model,
      provider: usageRecords.provider,
      totalRequests: count(usageRecords.id),
      totalInputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
      totalOutputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
      totalRevenueCents: drizzleSql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
    })
    .from(usageRecords)
    .where(drizzleSql`${usageRecords.createdAt} >= ${dateFilter}`)
    .groupBy(usageRecords.model, usageRecords.provider)
    .orderBy(desc(drizzleSql`sum(${usageRecords.totalCents})`))
    .limit(20);

    const dailyUsage = await db.select({
      date: drizzleSql<string>`date(${usageRecords.createdAt})`,
      totalRequests: count(usageRecords.id),
      totalRevenueCents: drizzleSql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      totalCostCents: drizzleSql<number>`coalesce(sum(${usageRecords.costCents}), 0)`,
      totalInputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
      totalOutputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
    })
    .from(usageRecords)
    .where(drizzleSql`${usageRecords.createdAt} >= ${dateFilter}`)
    .groupBy(drizzleSql`date(${usageRecords.createdAt})`)
    .orderBy(drizzleSql`date(${usageRecords.createdAt})`);

    const providerStatus = await db.select().from(providerHealth);

    const activeUsersResult = await db.select({
      count: count(drizzleSql`distinct ${usageRecords.userId}`),
    })
    .from(usageRecords)
    .where(drizzleSql`${usageRecords.createdAt} >= ${dateFilter}`);

    const totalUsersResult = await db.select({ count: count() }).from(users);

    const agg = aggregateUsage[0];
    const revenueCents = Number(agg?.totalRevenueCents || 0);
    const costCents = Number(agg?.totalCostCents || 0);

    return c.json({
      period,
      summary: {
        totalRequests: Number(agg?.totalRequests || 0),
        totalInputTokens: Number(agg?.totalInputTokens || 0),
        totalOutputTokens: Number(agg?.totalOutputTokens || 0),
        totalRevenue: revenueCents / 100,
        totalCost: costCents / 100,
        grossProfit: (revenueCents - costCents) / 100,
        margin: revenueCents > 0 ? ((revenueCents - costCents) / revenueCents * 100).toFixed(1) + "%" : "N/A",
        uniqueUsers: Number(activeUsersResult[0]?.count || 0),
        totalUsers: Number(totalUsersResult[0]?.count || 0),
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
        totalCost: Number(d.totalCostCents) / 100,
        totalInputTokens: Number(d.totalInputTokens),
        totalOutputTokens: Number(d.totalOutputTokens),
      })),
      providerHealth: providerStatus.map((p) => ({
        provider: p.provider,
        isUp: p.isUp,
        latencyMs: p.latencyMs,
        errorRate: Number(p.errorRate),
        lastCheckAt: p.lastCheckAt,
      })),
    });
  } catch (err) {
    console.error('Admin analytics overview error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});