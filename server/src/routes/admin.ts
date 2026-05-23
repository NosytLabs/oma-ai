import { Hono } from "hono";
import { db } from "../db/client.js";
import { users, apiKeys, usageRecords, deposits, creditBalances } from "../db/schema.js";
import { eq, desc, sql, count } from "drizzle-orm";
import { sessionAuth } from "../auth/middleware.js";
import type { OmaEnv } from "../types.js";
import { config } from "../config.js";

export const adminRoutes = new Hono<OmaEnv>();

function isAdminAddress(address: string): boolean {
  const adminAddresses = config.ADMIN_WALLET_ADDRESSES?.split(",").map(a => a.toLowerCase().trim()) ?? [];
  return adminAddresses.includes(address.toLowerCase());
}

adminRoutes.use("*", sessionAuth);
adminRoutes.use("*", async (c, next) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: { message: "Authentication required", type: "unauthorized" } }, 401);
  }

  const [user] = await db.select({ address: users.address }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !isAdminAddress(user.address)) {
    return c.json({ error: { message: "Admin access required", type: "forbidden" } }, 403);
  }

  await next();
});

adminRoutes.get("/admin/users", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = (page - 1) * limit;
  const _search = c.req.query("search") || "";

  try {
    const baseQuery = db.select({
      id: users.id,
      address: users.address,
      solanaAddress: users.solanaAddress,
      accountNumber: users.accountNumber,
      createdAt: users.createdAt,
      lastActivityAt: creditBalances.lastActivityAt,
      totalDepositedCents: creditBalances.totalDepositedCents,
      totalUsedCents: creditBalances.totalUsedCents,
      balanceCents: creditBalances.balanceCents,
      totalRequests: sql<number>`count(${usageRecords.id})`.as("total_requests"),
      totalInputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`.as("total_input_tokens"),
      totalOutputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`.as("total_output_tokens"),
    })
    .from(users)
    .leftJoin(creditBalances, eq(users.id, creditBalances.userId))
    .leftJoin(usageRecords, eq(users.id, usageRecords.userId))
    .groupBy(users.id, users.address, users.solanaAddress, users.accountNumber, users.createdAt, creditBalances.lastActivityAt, creditBalances.totalDepositedCents, creditBalances.totalUsedCents, creditBalances.balanceCents)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

    const results = await baseQuery;

    const totalResult = await db.select({ count: count() }).from(users);
    const total = totalResult[0]?.count || 0;

    return c.json({
      users: results.map((u) => ({
        ...u,
        balanceDollars: Number(u.balanceCents || 0) / 100,
        totalDeposited: Number(u.totalDepositedCents || 0) / 100,
        totalUsed: Number(u.totalUsedCents || 0) / 100,
        lastActivityAt: u.lastActivityAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Admin users error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

adminRoutes.get("/admin/users/:id", async (c) => {
  const userId = c.req.param("id");

  try {
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userResult.length) {
      return c.json({ error: { message: "User not found", type: "not_found" } }, 404);
    }

    const user = userResult[0];

    const balanceResult = await db.select().from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);
    const balance = balanceResult[0] || { balanceCents: "0", totalDepositedCents: "0", totalUsedCents: "0" };

    const keysResult = await db.select({
      id: apiKeys.id,
      keyPrefix: apiKeys.keyPrefix,
      name: apiKeys.name,
      active: apiKeys.active,
      createdAt: apiKeys.createdAt,
      totalRequests: sql<number>`count(${usageRecords.id})`.as("total_requests"),
      totalSpendCents: sql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`.as("total_spend_cents"),
    })
    .from(apiKeys)
    .leftJoin(usageRecords, eq(apiKeys.id, usageRecords.apiKeyId))
    .where(eq(apiKeys.userId, userId))
    .groupBy(apiKeys.id, apiKeys.keyPrefix, apiKeys.name, apiKeys.active, apiKeys.createdAt);

    const recentUsage = await db.select({
      id: usageRecords.id,
      model: usageRecords.model,
      provider: usageRecords.provider,
      inputTokens: usageRecords.inputTokens,
      outputTokens: usageRecords.outputTokens,
      costCents: usageRecords.totalCents,
      createdAt: usageRecords.createdAt,
    })
    .from(usageRecords)
    .where(eq(usageRecords.userId, userId))
    .orderBy(desc(usageRecords.createdAt))
    .limit(100);

    const depositsResult = await db.select({
      id: deposits.id,
      type: deposits.type,
      amountUsd: deposits.amountUsd,
      creditsIssued: deposits.creditsIssued,
      status: deposits.status,
      txHash: deposits.txHash,
      createdAt: deposits.createdAt,
      completedAt: deposits.completedAt,
    })
    .from(deposits)
    .where(eq(deposits.userId, userId))
    .orderBy(desc(deposits.createdAt))
    .limit(50);

    return c.json({
      user: {
        id: user.id,
        address: user.address,
        solanaAddress: user.solanaAddress,
        accountNumber: user.accountNumber,
        createdAt: user.createdAt,
      },
      balance: {
        balanceDollars: Number(balance.balanceCents || 0) / 100,
        totalDeposited: Number(balance.totalDepositedCents || 0) / 100,
        totalUsed: Number(balance.totalUsedCents || 0) / 100,
      },
      apiKeys: keysResult.map((k) => ({
        ...k,
        totalSpend: Number(k.totalSpendCents || 0) / 100,
      })),
      recentUsage: recentUsage.map((u) => ({
        ...u,
        cost: Number(u.costCents || 0) / 100,
      })),
      recentDeposits: depositsResult.map((d) => ({
        ...d,
        amount: Number(d.amountUsd || 0),
        credits: Number(d.creditsIssued || 0),
      })),
    });
  } catch (err) {
    console.error('Admin user detail error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

adminRoutes.get("/admin/usage", async (c) => {
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
    default:
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  try {
    const aggregateUsage = await db.select({
      totalRequests: count(usageRecords.id),
      totalInputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
      totalRevenueCents: sql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      totalCostCents: sql<number>`coalesce(sum(${usageRecords.costCents}), 0)`,
    })
    .from(usageRecords)
    .where(sql`${usageRecords.createdAt} >= ${dateFilter}`);

    const byProvider = await db.select({
      provider: usageRecords.provider,
      totalRequests: count(usageRecords.id),
      totalInputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
      totalRevenueCents: sql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      totalCostCents: sql<number>`coalesce(sum(${usageRecords.costCents}), 0)`,
    })
    .from(usageRecords)
    .where(sql`${usageRecords.createdAt} >= ${dateFilter}`)
    .groupBy(usageRecords.provider);

    const byModel = await db.select({
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
    .limit(20);

    const dailyUsage = await db.select({
      date: sql<string>`date(${usageRecords.createdAt})`,
      totalRequests: count(usageRecords.id),
      totalRevenueCents: sql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`,
    })
    .from(usageRecords)
    .where(sql`${usageRecords.createdAt} >= ${dateFilter}`)
    .groupBy(sql`date(${usageRecords.createdAt})`)
    .orderBy(sql`date(${usageRecords.createdAt})`);

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
    console.error('Admin usage error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

adminRoutes.get("/admin/revenue", async (c) => {
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
    console.error('Admin revenue error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

adminRoutes.get("/admin/keys", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "100");
  const offset = (page - 1) * limit;

  try {
    const keysResult = await db.select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      keyPrefix: apiKeys.keyPrefix,
      name: apiKeys.name,
      active: apiKeys.active,
      createdAt: apiKeys.createdAt,
      userAddress: users.address,
      totalRequests: sql<number>`count(${usageRecords.id})`.as("total_requests"),
      totalSpendCents: sql<number>`coalesce(sum(${usageRecords.totalCents}), 0)`.as("total_spend_cents"),
      lastUsedAt: sql<string>`max(${usageRecords.createdAt})`.as("last_used_at"),
    })
    .from(apiKeys)
    .leftJoin(users, eq(apiKeys.userId, users.id))
    .leftJoin(usageRecords, eq(apiKeys.id, usageRecords.apiKeyId))
    .groupBy(apiKeys.id, apiKeys.userId, apiKeys.keyPrefix, apiKeys.name, apiKeys.active, apiKeys.createdAt, users.address)
    .orderBy(desc(apiKeys.createdAt))
    .limit(limit)
    .offset(offset);

    const totalResult = await db.select({ count: count() }).from(apiKeys);

    return c.json({
      keys: keysResult.map((k) => ({
        id: k.id,
        userId: k.userId,
        userAddress: k.userAddress,
        keyPrefix: k.keyPrefix,
        name: k.name,
        active: k.active,
        createdAt: k.createdAt,
        totalRequests: Number(k.totalRequests || 0),
        totalSpend: Number(k.totalSpendCents || 0) / 100,
        lastUsedAt: k.lastUsedAt,
      })),
      pagination: {
        page,
        limit,
        total: totalResult[0]?.count || 0,
        pages: Math.ceil((totalResult[0]?.count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('Admin keys error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});