import { Hono } from "hono";
import { db } from "../db/client.js";
import { usageRecords, providerHealth, users } from "../db/schema.js";
import { desc, count, sql as drizzleSql } from "drizzle-orm";
import { sessionAuth, requireAdmin } from "../auth/middleware.js";
import type { OmaEnv } from "../types.js";
import { logger } from "../lib/logger.js";

export const adminAnalyticsRoutes = new Hono<OmaEnv>();

adminAnalyticsRoutes.use("/v1/admin/*", sessionAuth);
adminAnalyticsRoutes.use("/v1/admin/*", requireAdmin());

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
    const [
      analyticsAgg,
      byProvider,
      byModel,
      dailyUsage,
      providerStatus,
      totalUsersResult,
    ] = await Promise.all([
      db.execute<{
        total_requests: string;
        active_users: string;
        total_input_tokens: string;
        total_output_tokens: string;
        total_revenue_cents: string;
        total_cost_cents: string;
      }>(
        drizzleSql`
          WITH analytics AS (
            SELECT
              COUNT(*) FILTER (WHERE ${usageRecords.createdAt} >= ${dateFilter}) AS total_requests,
              COUNT(DISTINCT ${usageRecords.userId}) FILTER (WHERE ${usageRecords.createdAt} >= ${dateFilter}) AS active_users,
              COALESCE(SUM(${usageRecords.inputTokens}) FILTER (WHERE ${usageRecords.createdAt} >= ${dateFilter}), 0) AS total_input_tokens,
              COALESCE(SUM(${usageRecords.outputTokens}) FILTER (WHERE ${usageRecords.createdAt} >= ${dateFilter}), 0) AS total_output_tokens,
              COALESCE(SUM(${usageRecords.totalCents}) FILTER (WHERE ${usageRecords.createdAt} >= ${dateFilter}), 0) AS total_revenue_cents,
              COALESCE(SUM(${usageRecords.costCents}) FILTER (WHERE ${usageRecords.createdAt} >= ${dateFilter}), 0) AS total_cost_cents
            FROM ${usageRecords}
            WHERE ${usageRecords.createdAt} >= ${dateFilter}
          )
          SELECT * FROM analytics
        `
      ),
      db.select({
        provider: usageRecords.provider,
        totalRequests: count(usageRecords.id),
        totalInputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
        totalOutputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
        totalRevenueCents: drizzleSql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
        totalCostCents: drizzleSql<number>`coalesce(sum(${usageRecords.costCents}), 0)`,
      })
        .from(usageRecords)
        .where(drizzleSql`${usageRecords.createdAt} >= ${dateFilter}`)
        .groupBy(usageRecords.provider),
      db.select({
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
        .limit(20),
      db.select({
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
        .orderBy(drizzleSql`date(${usageRecords.createdAt})`),
      db.select().from(providerHealth),
      db.select({ count: count() }).from(users),
    ]);

    const agg = analyticsAgg.rows[0];

    const revenueCents = Number(agg?.total_revenue_cents || 0);
    const costCents = Number(agg?.total_cost_cents || 0);

    return c.json({
      period,
      summary: {
        totalRequests: Number(agg?.total_requests || 0),
        totalInputTokens: Number(agg?.total_input_tokens || 0),
        totalOutputTokens: Number(agg?.total_output_tokens || 0),
        totalRevenue: revenueCents / 100,
        totalCost: costCents / 100,
        grossProfit: (revenueCents - costCents) / 100,
        margin: revenueCents > 0 ? ((revenueCents - costCents) / revenueCents * 100).toFixed(1) + "%" : "N/A",
        uniqueUsers: Number(agg?.active_users || 0),
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
    logger.error({ err, period }, "Admin analytics overview error");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});