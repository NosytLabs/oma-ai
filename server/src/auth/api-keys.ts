import crypto from "crypto";
import net from "net";
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

// ─── IP allowlist library (G3) ─────────────────────────────────────────────────

export function normalizeIpOrCidr(s: string): string {
  // Strip IPv6 zone id ("fe80::1%eth0" → "fe80::1"), then trim.
  const noZone = s.includes("%") ? s.split("%")[0] : s;
  return noZone.trim();
}

/**
 * Validate a bare IP or CIDR block (IPv4 or IPv6). Uses Node's net.isIP and a
 * minimal CIDR suffix check — no external dep. Returns true iff valid.
 */
export function isValidIpOrCidr(s: string): boolean {
  if (typeof s !== "string" || s.length === 0) return false;
  const norm = normalizeIpOrCidr(s);
  if (!norm) return false;

  const slashIdx = norm.indexOf("/");
  if (slashIdx === -1) {
    // bare IP
    return netIsIp(norm) !== 0;
  }
  const ipPart = norm.slice(0, slashIdx);
  const prefixPart = norm.slice(slashIdx + 1);
  if (!ipPart || !prefixPart) return false;
  const family = netIsIp(ipPart);
  if (family === 0) return false;
  // prefix must be all digits
  if (!/^\d+$/.test(prefixPart)) return false;
  const prefix = Number(prefixPart);
  if (!Number.isFinite(prefix) || prefix < 0) return false;
  const max = family === 4 ? 32 : 128;
  return prefix <= max;
}

function netIsIp(s: string): 0 | 4 | 6 {
  // Ponytail: stdlib net.isIP — no third-party dep.
  const v = net.isIP(s);
  return v === 4 ? 4 : v === 6 ? 6 : 0;
}

function ipv4ToBigInt(ip: string): bigint {
  const parts = ip.split(".");
  if (parts.length !== 4) return -1n;
  let result = 0n;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return -1n;
    result = (result << 8n) | BigInt(n);
  }
  return result;
}

function ipv6ToBigInt(ip: string): bigint {
  // Handle :: expansion (zeros). Node's net.isIP already validated syntax.
  const dcIdx = ip.indexOf("::");
  let halves: [string, string];
  if (dcIdx === -1) {
    halves = [ip, ""];
  } else {
    halves = [ip.slice(0, dcIdx), ip.slice(dcIdx + 2)];
  }
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0) return -1n;
  const full = [...left, ...new Array(missing).fill("0"), ...right];
  if (full.length !== 8) return -1n;
  let result = 0n;
  for (const h of full) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(h)) return -1n;
    result = (result << 16n) | BigInt(parseInt(h, 16));
  }
  return result;
}

export function ipToBigInt(ip: string): bigint {
  const family = netIsIp(ip);
  if (family === 4) return ipv4ToBigInt(ip);
  if (family === 6) return ipv6ToBigInt(ip);
  return -1n;
}

/**
 * Check whether `ip` matches the bare-IP or CIDR `cidr`. Families must match
 * (an IPv4 IP never matches an IPv6 CIDR and vice versa). /0 is treated as
 * universal within the family.
 */
export function ipMatchesCidr(ip: string, cidr: string): boolean {
  const ipFamily = netIsIp(ip);
  if (ipFamily === 0) return false;
  const norm = normalizeIpOrCidr(cidr);
  const slashIdx = norm.indexOf("/");
  if (slashIdx === -1) {
    // bare IP — must be the same family
    if (netIsIp(norm) !== ipFamily) return false;
    return norm === ip;
  }
  const cidrIp = norm.slice(0, slashIdx);
  const prefixStr = norm.slice(slashIdx + 1);
  const cidrFamily = netIsIp(cidrIp);
  if (cidrFamily !== ipFamily) return false;
  const prefix = Number(prefixStr);
  const max = cidrFamily === 4 ? 32 : 128;
  if (prefix < 0 || prefix > max) return false;
  const ipN = ipFamily === 4 ? ipv4ToBigInt(ip) : ipv6ToBigInt(ip);
  const cidrN = cidrFamily === 4 ? ipv4ToBigInt(cidrIp) : ipv6ToBigInt(cidrIp);
  if (ipN < 0n || cidrN < 0n) return false;
  if (prefix === 0) return true;
  const shift = BigInt(max - prefix);
  // Mask by zeroing the lower `shift` bits
  const mask = (~((1n << shift) - 1n)) & ((1n << BigInt(max)) - 1n);
  return (ipN & mask) === (cidrN & mask);
}

/**
 * True iff `ip` is allowed by `list`. null/undefined/empty list = no
 * restriction (preserves pre-G3 behavior for all existing keys).
 */
export function isIpAllowedByList(
  ip: string,
  list: string[] | null | undefined,
): boolean {
  if (!list || list.length === 0) return true;
  for (const entry of list) {
    if (ipMatchesCidr(ip, entry)) return true;
  }
  return false;
}

/**
 * Validate and normalize an allowlist. Returns null for null/undefined/empty
 * input. Throws on the first invalid entry. Trims whitespace.
 */
export function validateIpAllowlist(
  list: string[] | null | undefined,
): string[] | null {
  if (list === null || list === undefined) return null;
  if (!Array.isArray(list) || list.length === 0) return null;
  const out: string[] = [];
  for (const raw of list) {
    if (typeof raw !== "string") {
      throw new Error("Invalid IP allowlist: entry is not a string");
    }
    const norm = normalizeIpOrCidr(raw);
    if (!isValidIpOrCidr(norm)) {
      throw new Error(`Invalid IP or CIDR: ${raw}`);
    }
    out.push(norm);
  }
  return out;
}

// ─── API key CRUD ──────────────────────────────────────────────────────────────

export interface CreateApiKeyOptions {
  expiresAt?: Date | null;
  ipAllowlist?: string[] | null;
}

export async function createApiKey(
  userId: string,
  name: string,
  options: CreateApiKeyOptions = {},
) {
  const raw = `oma_sk_${nanoid(32)}`;
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  const keyPrefix = raw.slice(0, 12);
  const expiresAt =
    options.expiresAt !== undefined
      ? options.expiresAt
      : config.DEFAULT_KEY_EXPIRY_DAYS > 0
        ? addDays(config.DEFAULT_KEY_EXPIRY_DAYS)
        : null;
  const ipAllowlist = validateIpAllowlist(options.ipAllowlist ?? null);
  const [created] = await db
    .insert(apiKeys)
    .values({
      userId,
      name,
      keyHash,
      keyPrefix,
      active: true,
      expiresAt,
      ipAllowlist: ipAllowlist ?? null,
    })
    .returning();
  return {
    key: raw,
    prefix: keyPrefix,
    id: created.id,
    name: created.name,
    createdAt: created.createdAt,
    expiresAt: created.expiresAt,
    ipAllowlist: created.ipAllowlist ?? null,
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
    // ponytail: v7 H2 — preserve IP allowlist on key rotation. Previously the
    // refreshed key dropped ipAllowlist silently, regressing the security
    // posture for users who had set an allowlist.
    ipAllowlist: existing.ipAllowlist,
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
  // H10: bump SameSite from Lax to Strict for browser requests carrying
  // the API key cookie. Strict prevents the cookie from being sent on
  // any cross-site request, including top-level navigations from
  // external links. The trade-off (deep-link flows that need the
  // cookie to "just work" after a redirect) is acceptable because
  // browser API key auth is for first-party dashboard usage only;
  // server-to-server clients should send Authorization: Bearer.
  let cookie = `${name}=${apiKey}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
  if (!isDev) {
    cookie += "; Secure";
  }
  return cookie;
}

export function createLogoutCookieHeader(): string {
  const isDev = config.NODE_ENV === "development";
  const name = isDev ? "oma_api_key" : "__Host-oma_api_key";
  let cookie = `${name}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
  if (!isDev) {
    cookie += "; Secure";
  }
  return cookie;
}
