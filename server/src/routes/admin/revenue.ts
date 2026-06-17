import { Hono } from "hono";
import { db } from "../../db/client.js";
import { users, usageRecords, deposits } from "../../db/schema.js";
import { sql, count } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { logger } from "../../lib/logger.js";

export const revenueRoutes = new Hono<OmaEnv>();

revenueRoutes.get("/admin/revenue", async (c) => {
  const period = c.req.query("period") || "30d";
  if (!["7d", "30d", "90d", "all"].includes(period)) {
    return c.json({ error: { message: "Invalid period. Must be 7d, 30d, 90d, or all", type: "invalid_request_error" } }, 400);
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
    case "all":
      dateFilter = new Date(0);
      break;
    default:
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  try {
    const revenueAgg = await db.select({
      totalRevenueCents: sql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      totalCostCents: sql<number>`coalesce(sum(${usageRecords.costCents}), 0)`,
    })
    .from(usageRecords)
    .where(sql`${usageRecords.createdAt} >= ${dateFilter}`);

    const depositsAgg = await db.select({
      totalDeposits: sql<number>`coalesce(sum(${deposits.amountUsd}), 0)`,
      count: count(deposits.id),
    })
    .from(deposits)
    .where(sql`${deposits.createdAt} >= ${dateFilter} and ${deposits.status} = 'completed'`);

    const monthlyRevenue = await db.select({
      month: sql<string>`to_char(${deposits.createdAt}, 'YYYY-MM')`,
      totalRevenue: sql<number>`coalesce(sum(${deposits.amountUsd}), 0)`,
      count: count(deposits.id),
    })
    .from(deposits)
    .where(sql`${deposits.createdAt} >= ${new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)} and ${deposits.status} = 'completed'`)
    .groupBy(sql`to_char(${deposits.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${deposits.createdAt}, 'YYYY-MM')`);

    const activeUsers = await db.select({ count: count() })
      .from(users)
      .where(sql`${users.createdAt} >= ${dateFilter}`);

    return c.json({
      period,
      summary: {
        totalRevenue: Number(revenueAgg[0]?.totalRevenueCents || 0) / 100,
        totalCost: Number(revenueAgg[0]?.totalCostCents || 0) / 100,
        grossProfit: (Number(revenueAgg[0]?.totalRevenueCents || 0) - Number(revenueAgg[0]?.totalCostCents || 0)) / 100,
        totalDeposits: Number(depositsAgg[0]?.totalDeposits || 0),
        depositCount: Number(depositsAgg[0]?.count || 0),
        newUsers: Number(activeUsers[0]?.count || 0),
      },
      monthlyRevenue: monthlyRevenue.map((m) => ({
        month: m.month,
        totalRevenue: Number(m.totalRevenue),
        depositCount: Number(m.count),
      })),
    });
  } catch (err) {
    logger.error({ err, period }, "Admin revenue error");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});