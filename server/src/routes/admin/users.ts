import { Hono } from "hono";
import { db } from "../../db/client.js";
import { users, creditBalances, usageRecords, deposits, apiKeys } from "../../db/schema.js";
import { eq, desc, sql, count } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";

const pageSchema = (await import("zod")).z.coerce.number().int().positive().default(1);
const limitSchema = (await import("zod")).z.coerce.number().int().positive().max(100).default(50);
const searchSchema = (await import("zod")).z.string().max(500).optional();

export const usersRoutes = new Hono<OmaEnv>();

usersRoutes.get("/admin/users", async (c) => {
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

usersRoutes.get("/admin/users/:id", async (c) => {
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

    const [balanceResult, keysResult, recentUsage, depositsResult] = await Promise.all([
      db.select().from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1),
      db.select({
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
      .groupBy(apiKeys.id, apiKeys.keyPrefix, apiKeys.name, apiKeys.active, apiKeys.createdAt),
      db.select({
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
      .limit(100),
      db.select({
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
      .limit(50),
    ]);

    const balance = balanceResult[0] || { balanceCents: "0", totalDepositedCents: "0", totalUsedCents: "0" };

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