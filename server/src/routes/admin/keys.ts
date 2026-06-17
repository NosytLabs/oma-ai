import { Hono } from "hono";
import { db } from "../../db/client.js";
import { apiKeys, users, usageRecords } from "../../db/schema.js";
import { eq, desc, sql, count } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { logger } from "../../lib/logger.js";

const pageSchema = (await import("zod")).z.coerce.number().int().positive().default(1);
const limitSchema = (await import("zod")).z.coerce.number().int().positive().max(100).default(50);

export const keysRoutes = new Hono<OmaEnv>();

keysRoutes.get("/admin/keys", async (c) => {
  const pageResult = pageSchema.safeParse(c.req.query("page") || "1");
  const page = pageResult.success ? pageResult.data : 1;
  const limitResult = limitSchema.safeParse(c.req.query("limit") || "100");
  const limit = limitResult.success ? limitResult.data : 100;
  const offset = (page - 1) * limit;

  try {
    const usageStats = db.select({
      apiKeyId: usageRecords.apiKeyId,
      totalRequests: sql<number>`cast(count(${usageRecords.id}) as bigint)`,
      totalSpendCents: sql<number>`cast(coalesce(sum(${usageRecords.totalCents}), 0) as bigint)`,
      lastUsedAt: sql<string>`max(${usageRecords.createdAt})`,
    })
    .from(usageRecords)
    .groupBy(usageRecords.apiKeyId);

    const keysResult = await db.select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      keyPrefix: apiKeys.keyPrefix,
      name: apiKeys.name,
      active: apiKeys.active,
      createdAt: apiKeys.createdAt,
      userAddress: users.address,
      totalRequests: sql<number>`coalesce(usage_stats.total_requests, 0)`,
      totalSpendCents: sql<number>`coalesce(usage_stats.total_spend_cents, 0)`,
      lastUsedAt: sql<string>`usage_stats.last_used_at`,
    })
    .from(apiKeys)
    .leftJoin(users, eq(apiKeys.userId, users.id))
    .leftJoin(
      sql<{
        apiKeyId: string | null;
        totalRequests: number;
        totalSpendCents: number;
        lastUsedAt: string | null;
      }>`(${usageStats}) as usage_stats`,
      sql`${apiKeys.id} = usage_stats.api_key_id`
    )
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
    logger.error({ err, page, limit }, "Admin keys error");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});