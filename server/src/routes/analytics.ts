import { z } from "zod";
import { Hono } from "hono";
import { db } from "../db/client.js";
import { usageRecords } from "../db/schema.js";
import { desc, count, sql as drizzleSql } from "drizzle-orm";
import { bearerAuth } from "../auth/middleware.js";
import type { OmaEnv } from "../types.js";
import { logger } from "../lib/logger.js";
import { parsePeriodDate } from "../lib/period.js";

const periodSchema = z.enum(["7d", "30d", "90d"]).default("30d");

export const analyticsRoutes = new Hono<OmaEnv>();

analyticsRoutes.use("/v1/analytics/*", bearerAuth);

analyticsRoutes.get("/v1/analytics/usage", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: { message: "Authentication required", type: "unauthorized" } }, 401);
  }

  const periodResult = periodSchema.safeParse(c.req.query("period") || "30d");
  const period = periodResult.success ? periodResult.data : "30d";
  const dateFilter = parsePeriodDate(period);

  try {
    const [aggregateUsage, byModel, dailyUsage, topModels] = await Promise.all([
      db.select({
        totalRequests: count(usageRecords.id),
        totalInputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
        totalOutputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
        totalCostCents: drizzleSql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      })
      .from(usageRecords)
      .where(drizzleSql`${usageRecords.userId} = ${userId} and ${usageRecords.createdAt} >= ${dateFilter}`),
      
      db.select({
        model: usageRecords.model,
        provider: usageRecords.provider,
        totalRequests: count(usageRecords.id),
        totalInputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
        totalOutputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
        totalCostCents: drizzleSql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      })
      .from(usageRecords)
      .where(drizzleSql`${usageRecords.userId} = ${userId} and ${usageRecords.createdAt} >= ${dateFilter}`)
      .groupBy(usageRecords.model, usageRecords.provider)
      .orderBy(desc(drizzleSql`sum(${usageRecords.totalCents})`))
      .limit(20),
      
      db.select({
        date: drizzleSql<string>`date(${usageRecords.createdAt})`,
        totalRequests: count(usageRecords.id),
        totalInputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
        totalOutputTokens: drizzleSql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
        totalCostCents: drizzleSql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      })
      .from(usageRecords)
      .where(drizzleSql`${usageRecords.userId} = ${userId} and ${usageRecords.createdAt} >= ${dateFilter}`)
      .groupBy(drizzleSql`date(${usageRecords.createdAt})`)
      .orderBy(drizzleSql`date(${usageRecords.createdAt})`),
      
      db.select({
        model: usageRecords.model,
        totalRequests: count(usageRecords.id),
      })
      .from(usageRecords)
      .where(drizzleSql`${usageRecords.userId} = ${userId} and ${usageRecords.createdAt} >= ${dateFilter}`)
      .groupBy(usageRecords.model)
      .orderBy(desc(drizzleSql`count(${usageRecords.id})`))
      .limit(10),
    ]);

    const agg = aggregateUsage[0];
    return c.json({
      period,
      summary: {
        totalRequests: Number(agg?.totalRequests || 0),
        totalInputTokens: Number(agg?.totalInputTokens || 0),
        totalOutputTokens: Number(agg?.totalOutputTokens || 0),
        totalCost: Number(agg?.totalCostCents || 0) / 100,
      },
      byModel: byModel.map((m) => ({
        model: m.model,
        provider: m.provider,
        totalRequests: Number(m.totalRequests),
        totalInputTokens: Number(m.totalInputTokens),
        totalOutputTokens: Number(m.totalOutputTokens),
        totalCost: Number(m.totalCostCents) / 100,
      })),
      dailyUsage: dailyUsage.map((d) => ({
        date: d.date,
        totalRequests: Number(d.totalRequests),
        totalInputTokens: Number(d.totalInputTokens),
        totalOutputTokens: Number(d.totalOutputTokens),
        totalCost: Number(d.totalCostCents) / 100,
      })),
      topModels: topModels.map((m) => ({
        model: m.model,
        totalRequests: Number(m.totalRequests),
      })),
    });
  } catch (err) {
    logger.error({ err, userId }, "Analytics usage error");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

analyticsRoutes.get("/v1/analytics/models", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: { message: "Authentication required", type: "unauthorized" } }, 401);
  }

  const periodResult = periodSchema.safeParse(c.req.query("period") || "30d");
  const period = periodResult.success ? periodResult.data : "30d";
  const dateFilter = parsePeriodDate(period);

  try {
    const popularModels = await db.select({
      model: usageRecords.model,
      provider: usageRecords.provider,
      totalRequests: count(usageRecords.id),
      totalCostCents: drizzleSql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
    })
    .from(usageRecords)
    .where(drizzleSql`${usageRecords.userId} = ${userId} and ${usageRecords.createdAt} >= ${dateFilter}`)
    .groupBy(usageRecords.model, usageRecords.provider)
    .orderBy(desc(drizzleSql`count(${usageRecords.id})`))
    .limit(10);

    return c.json({
      period,
      models: popularModels.map((m) => ({
        model: m.model,
        provider: m.provider,
        totalRequests: Number(m.totalRequests),
        totalCost: Number(m.totalCostCents) / 100,
      })),
    });
  } catch (err) {
    logger.error({ err, userId }, "Analytics models error");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});