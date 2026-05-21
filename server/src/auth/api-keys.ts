import crypto from "crypto";
import { nanoid } from "nanoid";
import { db } from "../db/client.js";
import { apiKeys } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    const dummy = Buffer.alloc(Math.max(bufA.length, bufB.length), 0);
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function createApiKey(userId: string, name: string) {
  const raw = `oma_sk_${nanoid(32)}`;
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  const keyPrefix = raw.slice(0, 12);
  const [created] = await db.insert(apiKeys).values({
    userId,
    name,
    keyHash,
    keyPrefix,
    active: true,
  }).returning();
  return {
    key: raw,
    prefix: keyPrefix,
    id: created.id,
    name: created.name,
    createdAt: created.createdAt,
  };
}

export async function validateApiKey(rawKey: string) {
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const results = await db.select().from(apiKeys).where(
    and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true))
  ).limit(1);
  if (results.length === 0) return null;
  const apiKey = results[0];
  const storedPrefix = apiKey.keyPrefix;
  const rawPrefix = rawKey.slice(0, storedPrefix.length);
  if (!timingSafeEqual(storedPrefix, rawPrefix)) return null;
  return apiKey;
}

export async function listApiKeys(userId: string) {
  const results = await db.select({
    id: apiKeys.id,
    keyPrefix: apiKeys.keyPrefix,
    name: apiKeys.name,
    active: apiKeys.active,
    createdAt: apiKeys.createdAt,
  }).from(apiKeys).where(eq(apiKeys.userId, userId));
  return results;
}

export async function revokeApiKey(userId: string, keyId: string) {
  const result = await db.update(apiKeys).set({ active: false }).where(
    and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId))
  ).returning();
  return result.length > 0 ? result[0] : null;
}

export async function deleteApiKey(userId: string, keyId: string) {
  const result = await db.delete(apiKeys).where(
    and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId))
  ).returning();
  return result.length > 0;
}
