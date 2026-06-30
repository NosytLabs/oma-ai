import crypto from "crypto";
import net from "net";
import { nanoid } from "nanoid";
import { db } from "../db/client.js";
import { apiKeys, type ApiKey } from "../db/schema.js";
import { eq, and, or, isNull, gt, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { config } from "../config.js";
import { getRedisClient } from "../lib/redis-client.js";

const KEY_ROTATION_WARNING_DAYS = 60;
const API_KEY_CACHE_TTL_SECONDS = 300;

const pendingLastUsedUpdates = new Set<string>();
let flushTimer: ReturnType<typeof setInterval> | null = null;

function startLastUsedFlusher(): void {
  if (flushTimer) return;
  flushTimer = setInterval(async () => {
    if (pendingLastUsedUpdates.size === 0) return;
    const ids = Array.from(pendingLastUsedUpdates);
    pendingLastUsedUpdates.clear();
    try {
      await db.update(apiKeys)
        .set({ lastUsedAt: sql`NOW()` })
        .where(inArray(apiKeys.id, ids));
    } catch {
      // best-effort batch update
    }
  }, 60_000);
}

function queueLastUsedUpdate(keyId: string): void {
  pendingLastUsedUpdates.add(keyId);
  if (!flushTimer) startLastUsedFlusher();
}

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

// ─── IP allowlist (single public function) ────────────────────────────────────

function netIsIp(s: string): 0 | 4 | 6 {
  const v = net.isIP(s);
  return v === 4 ? 4 : v === 6 ? 6 : 0;
}

function normalizeIpOrCidr(s: string): string {
  const noZone = s.includes("%") ? s.split("%")[0] : s;
  return noZone.trim();
}

function isValidIpOrCidr(s: string): boolean {
  if (typeof s !== "string" || s.length === 0) return false;
  const norm = normalizeIpOrCidr(s);
  if (!norm) return false;
  const slashIdx = norm.indexOf("/");
  if (slashIdx === -1) return netIsIp(norm) !== 0;
  const ipPart = norm.slice(0, slashIdx);
  const prefixPart = norm.slice(slashIdx + 1);
  if (!ipPart || !prefixPart) return false;
  const family = netIsIp(ipPart);
  if (family === 0) return false;
  if (!/^\d+$/.test(prefixPart)) return false;
  const prefix = Number(prefixPart);
  if (!Number.isFinite(prefix) || prefix < 0) return false;
  const max = family === 4 ? 32 : 128;
  return prefix <= max;
}

function ipToBits(ip: string, family: 4 | 6): bigint {
  if (family === 4) {
    return ip.split(".").reduce((acc, p) => (acc << 8n) | BigInt(Number(p)), 0n);
  }
  // IPv6
  const dcIdx = ip.indexOf("::");
  let halves: [string, string];
  if (dcIdx === -1) { halves = [ip, ""]; } else { halves = [ip.slice(0, dcIdx), ip.slice(dcIdx + 2)]; }
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const full = [...left, ...new Array(8 - left.length - right.length).fill("0"), ...right];
  return full.reduce((acc, h) => (acc << 16n) | BigInt(parseInt(h, 16)), 0n);
}

/**
 * True iff `ip` is allowed by `list`. null/undefined/empty list = no
 * restriction. Bare-IP and CIDR entries supported (IPv4 + IPv6).
 */
export function isIpAllowedByList(
  ip: string,
  list: string[] | null | undefined,
): boolean {
  if (!list || list.length === 0) return true;
  const ipFamily = netIsIp(ip);
  if (ipFamily === 0) return false;
  const maxBits = ipFamily === 4 ? 32 : 128;
  const ipN = ipToBits(ip, ipFamily);
  for (const entry of list) {
    const norm = normalizeIpOrCidr(entry);
    const slashIdx = norm.indexOf("/");
    if (slashIdx === -1) {
      if (netIsIp(norm) === ipFamily && norm === ip) return true;
      continue;
    }
    const cidrIp = norm.slice(0, slashIdx);
    const cidrFamily = netIsIp(cidrIp);
    if (cidrFamily !== ipFamily) continue;
    const prefix = Number(norm.slice(slashIdx + 1));
    if (prefix < 0 || prefix > maxBits) continue;
    if (prefix === 0) return true;
    const cidrN = ipToBits(cidrIp, cidrFamily);
    const shift = BigInt(maxBits - prefix);
    const mask = (~((1n << shift) - 1n)) & ((1n << BigInt(maxBits)) - 1n);
    if ((ipN & mask) === (cidrN & mask)) return true;
  }
  return false;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Validate and normalize an allowlist. Returns null for null/undefined/empty
 * input. Throws on the first invalid entry. Trims whitespace.
 */
function validateIpAllowlist(
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
  allowedModels?: string[] | null;
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
  const allowedModels =
    options.allowedModels !== undefined && options.allowedModels !== null
      ? (Array.isArray(options.allowedModels)
          ? options.allowedModels.filter((m) => typeof m === "string" && m.length > 0)
          : null)
      : null;
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
      allowedModels: allowedModels && allowedModels.length > 0 ? allowedModels : null,
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
    allowedModels: created.allowedModels ?? null,
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

  // Neon HTTP transport does not support transactions; run the read directly.
  // The previous `for("update")` row lock was guarding against a race where the
  // key's `active` flag flips between the SELECT and a subsequent write — but
  // we never write to apiKeys in this path (lastUsedAt is queued fire-and-forget
  // below). A read-committed SELECT is sufficient.
  const [apiKey] = await db.select().from(apiKeys).where(
    and(
      eq(apiKeys.keyHash, keyHash),
      eq(apiKeys.active, true),
      or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now))
    )
  ).limit(1);

  if (!apiKey) return null;
  queueLastUsedUpdate(apiKey.id);

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
    allowedModels: apiKeys.allowedModels,
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
    allowedModels: apiKeys.allowedModels,
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

export async function updateModelAllowlist(
  keyId: string,
  userId: string,
  models: string[],
): Promise<{ id: string; allowedModels: string[] | null } | null> {
  const normalized = models.length > 0 ? models.filter((m) => typeof m === "string" && m.length > 0) : [];
  const [result] = await db
    .update(apiKeys)
    .set({ allowedModels: normalized.length > 0 ? normalized : null })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id, allowedModels: apiKeys.allowedModels });
  return result ?? null;
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
