import { z } from "zod";
import { Hono } from "hono";
import { db } from "../db/client.js";
import { users, apiKeys, usageRecords, deposits, creditBalances, invoices, auditLogs } from "../db/schema.js";
import { eq, desc, sql, count, and, gte, lte } from "drizzle-orm";
import { sessionAuth, requireAdmin } from "../auth/middleware.js";
import { auditLog as _auditLog } from "../middleware/audit.js";
import type { OmaEnv } from "../types.js";
import { getSettlementDlqEntries, retrySettlementFromDlq, getSettlementDlqLength } from "../lib/dlq.js";
import { processSettlementDLQ, retrySettlementById, getSettlementDlqStatus } from "../lib/settlement-retry.js";
import { rateLimit } from "../middleware/rate-limit.js";

const pageSchema = z.coerce.number().int().positive().default(1);
const limitSchema = z.coerce.number().int().positive().max(100).default(50);
const searchSchema = z.string().max(500).optional();
const dateSchema = z.string().refine((d) => !isNaN(Date.parse(d)), { message: "Invalid date format" }).optional();

export const adminRoutes = new Hono<OmaEnv>();

adminRoutes.use("*", sessionAuth);
adminRoutes.use("*", requireAdmin());
adminRoutes.use("*", rateLimit({ windowMs: 60_000, maxRequests: 100 }));

adminRoutes.get("/admin/users", async (c) => {
  const pageResult = pageSchema.safeParse(c.req.query("page") || "1");
  const page = pageResult.success ? pageResult.data : 1;
  const limitResult = limitSchema.safeParse(c.req.query("limit") || "50");
  const limit = limitResult.success ? limitResult.data : 50;
  const offset = (page - 1) * limit;
  const searchResult = searchSchema.safeParse(c.req.query("search") || "");
  const _search = searchResult.success ? searchResult.data : "";

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
    console.error('Admin revenue error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

adminRoutes.get("/admin/keys", async (c) => {
  const pageResult = pageSchema.safeParse(c.req.query("page") || "1");
  const page = pageResult.success ? pageResult.data : 1;
  const limitResult = limitSchema.safeParse(c.req.query("limit") || "100");
  const limit = limitResult.success ? limitResult.data : 100;
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

adminRoutes.get("/v1/admin/audit-logs", async (c) => {
  const limitResult = limitSchema.safeParse(c.req.query("limit") || "50");
  const limit = limitResult.success ? limitResult.data : 50;
  const offsetResult = z.coerce.number().int().nonnegative().default(0).safeParse(c.req.query("offset") || "0");
  const offset = offsetResult.success ? offsetResult.data : 0;
  const userIdFilter = c.req.query("userId");
  const actionFilter = c.req.query("action");
  const resourceFilter = c.req.query("resource");
  const startDateResult = dateSchema.safeParse(c.req.query("startDate"));
  const startDate = startDateResult.success ? startDateResult.data : undefined;
  const endDateResult = dateSchema.safeParse(c.req.query("endDate"));
  const endDate = endDateResult.success ? endDateResult.data : undefined;

  try {
    const conditions = [];

    if (userIdFilter) {
      conditions.push(eq(auditLogs.userId, userIdFilter));
    }
    if (actionFilter) {
      conditions.push(eq(auditLogs.action, actionFilter as typeof auditLogs.$inferSelect.action));
    }
    if (resourceFilter) {
      conditions.push(eq(auditLogs.resource, resourceFilter));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const logsResult = await db
      .select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        action: auditLogs.action,
        resource: auditLogs.resource,
        resourceId: auditLogs.resourceId,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(whereClause);

    const logsWithParsedMetadata = logsResult.map((log) => ({
      ...log,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }));

    return c.json({
      logs: logsWithParsedMetadata,
      pagination: {
        limit,
        offset,
        total: Number(totalResult[0]?.count || 0),
      },
    });
  } catch (err) {
    console.error('Admin audit logs error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

adminRoutes.post("/admin/invoices", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, amount, lineItems, dueDate } = body;

    if (!userId || !amount || !lineItems || !dueDate) {
      return c.json({ error: { message: "Missing required fields: userId, amount, lineItems, dueDate" } }, 400);
    }

    const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userResult.length) {
      return c.json({ error: { message: "User not found", type: "not_found" } }, 404);
    }

    const lastInvoice = await db.select({ invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .orderBy(desc(invoices.createdAt))
      .limit(1);

    let nextNumber = 1;
    if (lastInvoice.length > 0) {
      const lastNum = lastInvoice[0].invoiceNumber;
      const match = lastNum.match(/INV-(\d{4})-(\d+)/);
      if (match) {
        const year = parseInt(match[1], 10);
        const seq = parseInt(match[2], 10);
        const currentYear = new Date().getFullYear();
        nextNumber = year === currentYear ? seq + 1 : 1;
      }
    }

    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(nextNumber).padStart(5, "0")}`;

    const lineItemsJson = JSON.stringify(lineItems);

    const result = await db.insert(invoices).values({
      invoiceNumber,
      userId,
      amount: amount.toString(),
      status: "pending",
      lineItems: lineItemsJson,
      dueDate: new Date(dueDate),
    }).returning();

    return c.json({ invoice: result[0] }, 201);
  } catch (err) {
    console.error('Admin create invoice error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

adminRoutes.get("/admin/invoices/:id", async (c) => {
  const invoiceId = c.req.param("id");

  try {
    const invoiceResult = await db.select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoiceResult.length) {
      return c.json({ error: { message: "Invoice not found", type: "not_found" } }, 404);
    }

    const invoice = invoiceResult[0];
    const userResult = await db.select({
      id: users.id,
      address: users.address,
      accountNumber: users.accountNumber,
    }).from(users).where(eq(users.id, invoice.userId)).limit(1);

    return c.json({
      invoice: {
        ...invoice,
        amount: Number(invoice.amount),
        lineItems: JSON.parse(invoice.lineItems),
        user: userResult[0] || null,
      },
    });
  } catch (err) {
    console.error('Admin invoice detail error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

adminRoutes.get("/admin/invoices", async (c) => {
  const page = Math.max(parseInt(c.req.query("page") || "1", 10), 1);
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const offset = (page - 1) * limit;
  const status = c.req.query("status");
  const userIdFilter = c.req.query("userId");

  try {
    const conditions = [];
    if (status) {
      conditions.push(eq(invoices.status, status as "draft" | "pending" | "paid" | "overdue" | "cancelled"));
    }
    if (userIdFilter) {
      conditions.push(eq(invoices.userId, userIdFilter));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db.select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      userId: invoices.userId,
      amount: invoices.amount,
      status: invoices.status,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      userAddress: users.address,
    })
    .from(invoices)
    .leftJoin(users, eq(invoices.userId, users.id))
    .where(whereClause)
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset);

    const totalResult = await db.select({ count: count() }).from(invoices).where(whereClause);
    const total = totalResult[0]?.count || 0;

    return c.json({
      invoices: results.map((inv) => ({
        ...inv,
        amount: Number(inv.amount),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Admin invoices list error:', err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

adminRoutes.get("/v1/admin/dlq/settlements", async (c) => {
  const page = Math.max(parseInt(c.req.query("page") || "1", 10), 1);
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const offset = (page - 1) * limit;

  try {
    const entries = await getSettlementDlqEntries(offset, limit);
    const total = await getSettlementDlqLength();
    const status = await getSettlementDlqStatus();

    return c.json({
      entries: entries.map((e) => ({
        orderId: e.orderId,
        amount: e.amount,
        chain: e.chain,
        attempts: e.attempts,
        lastError: e.lastError,
        createdAt: e.createdAt,
        status: e.attempts >= 3 ? "permanently_failed" : "retryable",
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      summary: {
        total,
        retryable: status.retryable,
        permanentlyFailed: status.permanentlyFailed,
      },
    });
  } catch (err) {
    console.error("Admin settlement DLQ error:", err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

adminRoutes.post("/v1/admin/dlq/settlements/:id/retry", async (c) => {
  const id = c.req.param("id");

  try {
    const result = await retrySettlementById(id);

    if (result.error && result.error === "Settlement not found in DLQ") {
      return c.json({ error: { message: "Settlement not found in DLQ", type: "not_found" } }, 404);
    }

    return c.json({
      orderId: result.orderId,
      success: result.success,
      attempts: result.attempts,
      error: result.error,
      permanentlyFailed: result.permanentlyFailed,
    });
  } catch (err) {
    console.error("Admin settlement retry error:", err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

adminRoutes.post("/v1/admin/dlq/settlements/:id/discard", async (c) => {
  const id = c.req.param("id");

  try {
    const entries = await getSettlementDlqEntries(0, await getSettlementDlqLength());
    const entry = entries.find((e) => e.orderId === id);

    if (!entry) {
      return c.json({ error: { message: "Settlement not found in DLQ", type: "not_found" } }, 404);
    }

    await retrySettlementFromDlq();

    return c.json({
      orderId: id,
      discarded: true,
    });
  } catch (err) {
    console.error("Admin settlement discard error:", err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

adminRoutes.post("/v1/admin/dlq/settlements/process", async (c) => {
  try {
    const results = await processSettlementDLQ();

    return c.json({
      processed: results.length,
      results: results.map((r) => ({
        orderId: r.orderId,
        success: r.success,
        attempts: r.attempts,
        error: r.error,
        permanentlyFailed: r.permanentlyFailed,
      })),
    });
  } catch (err) {
    console.error("Admin settlement DLQ process error:", err);
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});