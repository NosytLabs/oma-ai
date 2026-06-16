// API key management routes — extracted from routes/auth.ts (v9 Router extraction).
// Endpoints: GET /keys, POST /keys, DELETE /keys/:id, PATCH /keys/:id,
//            GET /keys/:id/allowlist, PATCH /keys/:id/allowlist.
// All require session auth. Mounted at root in server/src/index.ts so the
// client-facing paths (already in production: /keys, /keys/:id) are unchanged.
import { Hono } from "hono";
import { z } from "zod";
import { sessionAuth } from "../auth/middleware.js";
import { createApiKey, listApiKeys, revokeApiKey, getApiKey, updateModelAllowlist } from "../auth/api-keys.js";
import { db } from "../db/client.js";
import { apiKeys, rateLimitOverrides } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { validationError } from "../lib/validation.js";
import type { OmaEnv } from "../types.js";

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
});

const rateLimitOverrideSchema = z.object({
  rpm: z.number().min(1).optional(),
  tpm: z.number().min(100).optional(),
  expiresAt: z.string().datetime().optional(),
});

const allowlistSchema = z.object({
  models: z.array(z.string()).default([]),
});

export const keysRoutes = new Hono<OmaEnv>();

keysRoutes.get("/keys", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const keys = await listApiKeys(userId);
  return c.json({ keys });
});

keysRoutes.post("/keys", sessionAuth, async (c) => {
  const parsed = createKeySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const userId = c.get("userId");
  const { name } = parsed.data;
  const result = await createApiKey(userId, name);
  return c.json({ key: result.key, prefix: result.prefix, id: result.id ?? "", name: result.name, createdAt: result.createdAt }, 201);
});

keysRoutes.delete("/keys/:id", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("id") ?? "";
  const result = await revokeApiKey(String(userId), keyId);
  if (!result) return c.json({ error: { message: "API key not found", type: "not_found" } }, 404);
  return c.json({ success: true });
});

keysRoutes.patch("/keys/:id", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("id") ?? "";
  const parsed = rateLimitOverrideSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const existing = await db.select({ id: apiKeys.id }).from(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId))).limit(1);
  if (!existing.length) return c.json({ error: { message: "API key not found", type: "not_found" } }, 404);

  const { rpm, tpm, expiresAt } = parsed.data;

  const [existingOverride] = await db
    .select()
    .from(rateLimitOverrides)
    .where(and(eq(rateLimitOverrides.targetType, "api_key"), eq(rateLimitOverrides.targetId, keyId)))
    .limit(1);

  if (existingOverride) {
    await db.update(rateLimitOverrides)
      .set({ rpm: rpm ?? existingOverride.rpm, tpm: tpm ?? existingOverride.tpm, expiresAt: expiresAt ? new Date(expiresAt) : existingOverride.expiresAt })
      .where(eq(rateLimitOverrides.id, existingOverride.id));
  } else {
    await db.insert(rateLimitOverrides).values({
      targetType: "api_key",
      targetId: keyId,
      rpm,
      tpm,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
  }

  return c.json({ success: true });
});

keysRoutes.get("/keys/:id/allowlist", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("id") ?? "";
  const entry = await getApiKey(userId, keyId);
  if (!entry) return c.json({ error: { message: "API key not found", type: "not_found" } }, 404);
  return c.json({ models: entry.allowedModels ?? [] });
});

keysRoutes.patch("/keys/:id/allowlist", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("id") ?? "";
  const parsed = allowlistSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const result = await updateModelAllowlist(keyId, userId, parsed.data.models);
  if (!result) return c.json({ error: { message: "API key not found", type: "not_found" } }, 404);
  return c.json({ models: result.allowedModels ?? [] });
});
