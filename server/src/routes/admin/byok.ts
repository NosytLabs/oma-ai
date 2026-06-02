import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db/client.js";
import { byokKeys } from "../../db/schema.js";
import { eq, desc, count } from "drizzle-orm";
import {
  createBYOKKey,
  listBYOKKeys,
  deleteBYOKKey,
  addVeniceAsBYOK,
  configureBYOKOrdering,
  type BYOKKey,
} from "../../inference/openrouter.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";
import type { OmaEnv } from "../../types.js";

const createSchema = z.object({
  provider: z.string().min(1).max(64),
  key: z.string().min(1).max(2048),
  name: z.string().min(1).max(128),
});

const orderingSchema = z.object({
  allowFallbacks: z.boolean().optional().default(true),
  preferredOrder: z.array(z.string().min(1).max(64)).max(16).optional().default(["venice", "openrouter"]),
});

const pageSchema = z.coerce.number().int().positive().default(1);
const limitSchema = z.coerce.number().int().positive().max(100).default(50);

function isOpenRouterConfigured(): boolean {
  return Boolean(config.OPENROUTER_API_KEY);
}

export const byokRoutes = new Hono<OmaEnv>();

byokRoutes.get("/admin/byok", async (c) => {
  if (!isOpenRouterConfigured()) {
    return c.json({ error: { message: "OpenRouter not configured", type: "service_unavailable" } }, 503);
  }

  const pageResult = pageSchema.safeParse(c.req.query("page") || "1");
  const page = pageResult.success ? pageResult.data : 1;
  const limitResult = limitSchema.safeParse(c.req.query("limit") || "50");
  const limit = limitResult.success ? limitResult.data : 50;
  const offset = (page - 1) * limit;

  try {
    const remote = await listBYOKKeys().catch((err: Error) => {
      logger.error({ error: err.message }, "[byok] listBYOKKeys failed");
      return [] as BYOKKey[];
    });

    const totalResult = await db.select({ count: count() }).from(byokKeys);
    const cached = await db
      .select()
      .from(byokKeys)
      .orderBy(desc(byokKeys.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      keys: remote.map((k) => ({
        id: k.id,
        provider: k.provider,
        name: k.name,
        createdAt: k.createdAt,
      })),
      cached: cached.map((k) => ({
        id: k.id,
        byokKeyId: k.byokKeyId,
        provider: k.provider,
        name: k.name,
        lastSyncedAt: k.lastSyncedAt,
        createdAt: k.createdAt,
      })),
      pagination: {
        page,
        limit,
        total: totalResult[0]?.count || 0,
        pages: Math.ceil((totalResult[0]?.count || 0) / limit),
      },
    });
  } catch (err) {
    logger.error({ error: (err as Error).message }, "[byok] list error");
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
});

byokRoutes.post("/admin/byok", async (c) => {
  if (!isOpenRouterConfigured()) {
    return c.json({ error: { message: "OpenRouter not configured", type: "service_unavailable" } }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid request", type: "invalid_request_error", issues: parsed.error.flatten() } }, 400);
  }

  try {
    const created = await createBYOKKey(parsed.data.provider, parsed.data.key, parsed.data.name);

    await db
      .insert(byokKeys)
      .values({
        byokKeyId: created.id,
        provider: created.provider,
        name: created.name,
      })
      .onConflictDoUpdate({
        target: byokKeys.byokKeyId,
        set: { provider: created.provider, name: created.name, lastSyncedAt: new Date() },
      });

    return c.json({ id: created.id, provider: created.provider, name: created.name, createdAt: created.createdAt }, 201);
  } catch (err) {
    logger.error({ error: (err as Error).message }, "[byok] create error");
    return c.json({ error: { message: (err as Error).message || "Failed to create BYOK key" } }, 502);
  }
});

byokRoutes.delete("/admin/byok/:id", async (c) => {
  if (!isOpenRouterConfigured()) {
    return c.json({ error: { message: "OpenRouter not configured", type: "service_unavailable" } }, 503);
  }

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: { message: "BYOK key id required" } }, 400);
  }

  try {
    await deleteBYOKKey(id);
    await db.delete(byokKeys).where(eq(byokKeys.byokKeyId, id));
    return c.json({ deleted: true, id });
  } catch (err) {
    logger.error({ error: (err as Error).message, id }, "[byok] delete error");
    return c.json({ error: { message: (err as Error).message || "Failed to delete BYOK key" } }, 502);
  }
});

byokRoutes.post("/admin/byok/venice", async (c) => {
  if (!isOpenRouterConfigured()) {
    return c.json({ error: { message: "OpenRouter not configured", type: "service_unavailable" } }, 503);
  }

  const veniceKey = config.VENICE_API_KEY;
  if (!veniceKey) {
    return c.json({ error: { message: "VENICE_API_KEY not configured", type: "service_unavailable" } }, 503);
  }

  const result = await addVeniceAsBYOK(veniceKey);
  if (!result.success) {
    return c.json({ error: { message: result.error || "Failed to add Venice BYOK key" } }, 502);
  }

  if (result.byokKey) {
    await db
      .insert(byokKeys)
      .values({
        byokKeyId: result.byokKey.id,
        provider: result.byokKey.provider,
        name: result.byokKey.name,
      })
      .onConflictDoUpdate({
        target: byokKeys.byokKeyId,
        set: { provider: result.byokKey.provider, name: result.byokKey.name, lastSyncedAt: new Date() },
      });
  }

  return c.json({ success: true, byokKey: result.byokKey });
});

byokRoutes.post("/admin/byok/ordering", async (c) => {
  if (!isOpenRouterConfigured()) {
    return c.json({ error: { message: "OpenRouter not configured", type: "service_unavailable" } }, 503);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = orderingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid request", type: "invalid_request_error", issues: parsed.error.flatten() } }, 400);
  }

  const result = await configureBYOKOrdering(parsed.data.allowFallbacks, parsed.data.preferredOrder);
  if (!result.success) {
    return c.json({ error: { message: result.error || "Failed to configure BYOK ordering" } }, 502);
  }
  return c.json({ success: true, allowFallbacks: parsed.data.allowFallbacks, preferredOrder: parsed.data.preferredOrder });
});
