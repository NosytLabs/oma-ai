import { Hono } from "hono";
import { db } from "../../db/client.js";
import { apiKeys, users, usageRecords } from "../../db/schema.js";
import { eq, desc, sql, count, inArray } from "drizzle-orm";
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
    // Inline subquery with explicit column aliases. Drizzle's select({...}).as(name)
    // generates aliases from the field KEYS but PG interprets the underlying
    // expression (e.g. count(*)) without an alias — producing a subquery that
    // has no usable column names. Use raw SQL with explicit `as name`.
    // Two-step query: get keys first, then aggregate per-key usage in a
    // single batched query. Drizzle's select({...}).as(name) aliasing is
    // broken for COUNT/SUM aggregates without explicit `as` clauses, and
    // Drizzle 0.45's leftJoinLateral wraps the subquery in a way that
    // confuses pg. Two queries (cheap, single round-trip) is the clean fix.
    const keysResult = await db.select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      keyPrefix: apiKeys.keyPrefix,
      name: apiKeys.name,
      active: apiKeys.active,
      createdAt: apiKeys.createdAt,
      userAddress: users.address,
    })
    .from(apiKeys)
    .leftJoin(users, eq(apiKeys.userId, users.id))
    .orderBy(desc(apiKeys.createdAt))
    .limit(limit)
    .offset(offset);

    // Per-key usage aggregates in a single query
    const usageByKey = new Map<string, { totalRequests: number; totalSpendCents: number; lastUsedAt: string | null }>();
    if (keysResult.length > 0) {
      const keyIds = keysResult.map((k) => k.id);
      const agg = await db.select({
        apiKeyId: usageRecords.apiKeyId,
        totalRequests: sql<number>`cast(count(*) as bigint)`,
        totalSpendCents: sql<number>`cast(coalesce(sum("total_cents"), 0) as bigint)`,
        lastUsedAt: sql<string | null>`max("created_at")`,
      })
      .from(usageRecords)
      .where(inArray(usageRecords.apiKeyId, keyIds))
      .groupBy(usageRecords.apiKeyId);
      for (const a of agg) {
        if (!a.apiKeyId) continue;
        usageByKey.set(a.apiKeyId, {
          totalRequests: Number(a.totalRequests ?? 0),
          totalSpendCents: Number(a.totalSpendCents ?? 0),
          lastUsedAt: a.lastUsedAt ?? null,
        });
      }
    }

    const totalResult = await db.select({ count: count() }).from(apiKeys);

    return c.json({
      keys: keysResult.map((k) => {
        const u = usageByKey.get(k.id);
        return {
          id: k.id,
          userId: k.userId,
          userAddress: k.userAddress,
          keyPrefix: k.keyPrefix,
          name: k.name,
          active: k.active,
          createdAt: k.createdAt,
          totalRequests: u?.totalRequests ?? 0,
          totalSpend: (u?.totalSpendCents ?? 0) / 100,
          lastUsedAt: u?.lastUsedAt ?? null,
        };
      }),
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