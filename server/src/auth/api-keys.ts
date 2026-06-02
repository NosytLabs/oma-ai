import crypto from "crypto";
import { nanoid } from "nanoid";
import { db } from "../db/client.js";
import { apiKeys, type ApiKey } from "../db/schema.js";
import { eq, and, or, isNull, gt } from "drizzle-orm";
import { config } from "../config.js";
import { getRedisClient } from "../lib/redis-client.js";

const KEY_ROTATION_WARNING_DAYS = 60;
const API_KEY_CACHE_TTL_SECONDS = 300;

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function addDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export async function createApiKey(userId: string, name: string) {
  const raw = `oma_sk_${nanoid(32)}`;
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  const keyPrefix = raw.slice(0, 12);
  const expiresAt = config.DEFAULT_KEY_EXPIRY_DAYS > 0 ? addDays(config.DEFAULT_KEY_EXPIRY_DAYS) : null;
  const [created] = await db.insert(apiKeys).values({
    userId,
    name,
    keyHash,
    keyPrefix,
    active: true,
    expiresAt,
  }).returning();
  return {
    key: raw,
    prefix: keyPrefix,
    id: created.id,
    name: created.name,
    createdAt: created.createdAt,
    expiresAt: created.expiresAt,
  };
}

export async function validateApiKey(rawKey: string): Promise<ApiKey | null> {
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const now = new Date();

  const redis = await getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(`apikey:${keyHash}`);
      if (cached) {
        const apiKey = JSON.parse(cached) as ApiKey;
        const rawPrefix = rawKey.slice(0, 12);
        if (!timingSafeEqual(apiKey.keyPrefix, rawPrefix)) return null;
        if (apiKey.active === false) {
          await redis.del(`apikey:${keyHash}`);
          return null;
        }
        if (apiKey.expiresAt && new Date(apiKey.expiresAt) < now) {
          return { ...apiKey, expired: true };
        }
        await redis.setEx(`apikey:${keyHash}`, API_KEY_CACHE_TTL_SECONDS, JSON.stringify(apiKey));
        return apiKey;
      }
    } catch { /* ignore cache errors */ }
  }

  const result = await db.transaction(async (tx) => {
    const [apiKey] = await tx.select().from(apiKeys).where(
      and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.active, true),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now))
      )
    ).for("update");

    if (!apiKey) return null;

    await tx.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, apiKey.id));
    return apiKey;
  });

  if (!result) return null;
  const apiKey = result;
  const rawPrefix = rawKey.slice(0, 12);
  if (!timingSafeEqual(apiKey.keyPrefix, rawPrefix)) return null;
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < now) {
    return { ...apiKey, expired: true };
  }

  if (redis) {
    try {
      await redis.setEx(`apikey:${keyHash}`, API_KEY_CACHE_TTL_SECONDS, JSON.stringify(apiKey));
    } catch { /* ignore cache errors */ }
  }

  return apiKey;
}

export function shouldRecommendRotation(createdAt: Date): boolean {
  const ageMs = Date.now() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays >= KEY_ROTATION_WARNING_DAYS;
}

export async function listApiKeys(userId: string) {
  const results = await db.select({
    id: apiKeys.id,
    keyPrefix: apiKeys.keyPrefix,
    name: apiKeys.name,
    active: apiKeys.active,
    lastUsedAt: apiKeys.lastUsedAt,
    expiresAt: apiKeys.expiresAt,
    createdAt: apiKeys.createdAt,
  }).from(apiKeys).where(eq(apiKeys.userId, userId));
  return results;
}

export async function getApiKey(userId: string, keyId: string) {
  const [result] = await db.select({
    id: apiKeys.id,
    keyPrefix: apiKeys.keyPrefix,
    name: apiKeys.name,
    active: apiKeys.active,
    lastUsedAt: apiKeys.lastUsedAt,
    expiresAt: apiKeys.expiresAt,
    createdAt: apiKeys.createdAt,
  }).from(apiKeys).where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId))).limit(1);
  return result || null;
}

export async function revokeApiKey(userId: string, keyId: string) {
  const result = await db.update(apiKeys).set({ active: false }).where(
    and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId))
  ).returning();
  if (result.length > 0) {
    const redis = await getRedisClient();
    if (redis) {
      try {
        await redis.del(`apikey:${result[0].keyHash}`);
      } catch { /* ignore cache errors */ }
    }
  }
  return result.length > 0 ? result[0] : null;
}

export async function deleteApiKey(userId: string, keyId: string) {
  const result = await db.delete(apiKeys).where(
    and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId))
  ).returning();
  return result.length > 0;
}

export async function refreshApiKey(userId: string, keyId: string) {
  const [existing] = await db.select().from(apiKeys).where(
    and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId))
  ).limit(1);
  if (!existing) return null;

  const raw = `oma_sk_${nanoid(32)}`;
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  const keyPrefix = raw.slice(0, 12);
  const expiresAt = config.DEFAULT_KEY_EXPIRY_DAYS > 0 ? addDays(config.DEFAULT_KEY_EXPIRY_DAYS) : null;

  await db.update(apiKeys).set({ active: false }).where(eq(apiKeys.id, keyId));
  {
    const redis = await getRedisClient();
    if (redis) {
      try {
        await redis.del(`apikey:${existing.keyHash}`);
      } catch { /* ignore cache errors */ }
    }
  }

  const [created] = await db.insert(apiKeys).values({
    userId,
    name: existing.name,
    keyHash,
    keyPrefix,
    active: true,
    expiresAt,
  }).returning();

  return {
    key: raw,
    prefix: keyPrefix,
    id: created.id,
    name: created.name,
    createdAt: created.createdAt,
    expiresAt: created.expiresAt,
  };
}

export function createApiKeyCookieHeader(apiKey: string): string {
  const isDev = config.NODE_ENV === "development";
  const maxAge = 7 * 24 * 60 * 60;
  const name = isDev ? "oma_api_key" : "__Host-oma_api_key";
  let cookie = `${name}=${apiKey}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  if (!isDev) {
    cookie += "; Secure";
  }
  return cookie;
}

export function createLogoutCookieHeader(): string {
  const isDev = config.NODE_ENV === "development";
  const name = isDev ? "oma_api_key" : "__Host-oma_api_key";
  let cookie = `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  if (!isDev) {
    cookie += "; Secure";
  }
  return cookie;
}
