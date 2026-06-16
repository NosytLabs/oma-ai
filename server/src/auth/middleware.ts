import type { Context, Next } from "hono";
import { validateApiKey, shouldRecommendRotation, isIpAllowedByList } from "./api-keys.js";
import { verifySessionToken } from "./siwe.js";
import { decryptSecret } from "./encryption.js";
import { db } from "../db/client.js";
import { users, teamMembers } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import type { ApiKey } from "../db/schema.js";
import { authenticator } from "@otplib/preset-default";
import { getRedisClient } from "../lib/redis-client.js";
import { config, ADMIN_WALLET_ADDRESSES_SET } from "../config.js";
import { extractClientIp } from "../middleware/rate-limit/utils.js";
import { logger } from "../lib/logger.js";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function isValidEthereumAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address);
}

function validateAdminAddresses(): void {
  if (!config.ADMIN_WALLET_ADDRESSES) return;

  const addresses = config.ADMIN_WALLET_ADDRESSES.split(",").map((a) => a.trim()).filter(Boolean);

  for (const address of addresses) {
    if (!isValidEthereumAddress(address)) {
      console.error(`[FATAL] ADMIN_WALLET_ADDRESSES contains invalid Ethereum address: ${address}`);
      process.exit(1);
    }
  }
}

const validProductionEnvironments = ["production", "staging", "preview"];
const isProductionEnv = validProductionEnvironments.includes(config.NODE_ENV);
if (isProductionEnv) {
  validateAdminAddresses();
}

// SEC-7: singleflight dedup. Concurrent requests for the same key share
// one in-flight validateApiKey() promise so the underlying DB transaction
// (with its SELECT ... FOR UPDATE + lastUsedAt write) runs at most once
// per key. The lock is cleared on both success and failure so a later
// request can retry a transient failure.
type SingleflightRecord = { promise: Promise<unknown> };
const singleflightInflight = new Map<string, SingleflightRecord>();

export async function singleflight<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
  const existing = singleflightInflight.get(key);
  if (existing) {
    return existing.promise as Promise<T>;
  }
  const promise = (async () => {
    try {
      return await fn();
    } finally {
      singleflightInflight.delete(key);
    }
  })();
  singleflightInflight.set(key, { promise });
  return promise;
}

export async function bearerAuth(c: Context<OmaEnv>, next: Next) {
  // Accept the API key from either the Authorization header (server-to-server,
  // CLI tools, custom integrations) OR the `oma_api_key` / `__Host-oma_api_key`
  // HttpOnly cookie (browser requests where JS cannot read HttpOnly cookies).
  let rawKey: string | null = null;
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    rawKey = authHeader.slice(7);
  } else {
    const cookieHeader = c.req.header("Cookie") || "";
    const match = cookieHeader.match(/(?:^|;\s*)(?:__Host-)?oma_api_key=([^;]+)/);
    if (match) rawKey = decodeURIComponent(match[1]);
  }
  if (!rawKey) {
    return c.json({ error: { message: "Missing or invalid Authorization header", type: "authentication_error" } }, 401);
  }

  let apiKey: ApiKey | null;
  try {
    // SEC-7: dedup concurrent validateApiKey calls per raw key.
    apiKey = (await singleflight(`apikey:${rawKey}`, () => validateApiKey(rawKey!))) as ApiKey | null;
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err), type: 'auth_validation_error' }, "[bearerAuth] validateApiKey threw");
    return c.json({ error: { message: "Invalid API key", type: "authentication_error" } }, 401);
  }

  if (!apiKey) {
    return c.json({ error: { message: "Invalid API key", type: "authentication_error" } }, 401);
  }
  if (apiKey.expired) {
    return c.json({ error: { message: "API key expired", type: "authentication_error", code: "expired_api_key" } }, 401);
  }
  // G3: IP allowlist enforcement — null/empty list means no restriction.
  if (apiKey.ipAllowlist && apiKey.ipAllowlist.length > 0) {
    const clientIp = extractClientIp(c);
    if (!isIpAllowedByList(clientIp, apiKey.ipAllowlist)) {
      return c.json({ error: { message: "IP not allowed for this API key", type: "forbidden", code: "ip_not_allowed" } }, 403);
    }
  }
  c.set("apiKey", apiKey);
  c.set("userId", apiKey.userId);
  if (apiKey.createdAt && shouldRecommendRotation(new Date(apiKey.createdAt))) {
    c.res.headers.set("X-Key-Rotation-Recommended", "true");
  }
  await next();
}

export async function sessionAuth(c: Context<OmaEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: { message: "Missing or invalid Authorization header", type: "authentication_error" } }, 401);
  }
  const token = authHeader.slice(7);

  let session: { userId: string; authMethod: string } | null;
  try {
    session = (await verifySessionToken(token)) as { userId: string; authMethod: string } | null;
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err), type: 'auth_validation_error' }, "[sessionAuth] verifySessionToken threw");
    return c.json({ error: { message: "Invalid or expired session token", type: "authentication_error" } }, 401);
  }
  if (!session) {
    return c.json({ error: { message: "Invalid or expired session token", type: "authentication_error" } }, 401);
  }
  c.set("userId", session.userId);
  c.set("authMethod", session.authMethod as "siwe" | "solana" | "account-number" | "sso");

  const [user] = await db.select({ twoFactorEnabled: users.twoFactorEnabled }).from(users).where(eq(users.id, session.userId)).limit(1);
  if (user?.twoFactorEnabled) {
    const redis = await getRedisClient();
    if (!redis) {
      return c.json({ error: { message: "Authentication service unavailable", type: "server_error" } }, 503);
    }
    const failKey = `2fa_fail:${session.userId}`;

    // SEC-7: atomic INCR-then-check. The pre-fix code did `GET failKey`
    // then `INCR` after the verify, which let N concurrent requests all
    // see `fails < 5` and bypass the brute-force cap. INCR is atomic in
    // Redis; the post-increment value is unique per request.
    const newCount = await redis.incr(failKey);
    if (newCount === 1) {
      // First failure in this window — set the TTL exactly once so the
      // 5-min cap doesn't slide forward on every retry.
      await redis.expire(failKey, 300);
    }
    if (newCount >= 5) {
      return c.json({ error: { message: "Too many 2FA attempts", type: "authentication_error", code: "2fa_brute_force" } }, 429);
    }

    const twoFactorCode = c.req.header("X-2FA-Code");
    if (!twoFactorCode) {
      return c.json({ error: { message: "2FA code required", type: "authentication_error", code: "2fa_required" } }, 401);
    }
    const [userWithSecret] = await db.select({ twoFactorSecret: users.twoFactorSecret }).from(users).where(eq(users.id, session.userId)).limit(1);
    if (userWithSecret?.twoFactorSecret) {
      let secret: string;
      try {
        const parsed = JSON.parse(userWithSecret.twoFactorSecret);
        secret = decryptSecret(parsed.encrypted, parsed.iv, parsed.authTag);
      } catch {
        return c.json({ error: { message: "Failed to decrypt 2FA secret", type: "internal_error" } }, 500);
      }
      const isValid = authenticator.verify({ token: twoFactorCode, secret });
      if (!isValid) {
        return c.json({ error: { message: "Invalid 2FA code", type: "authentication_error" } }, 401);
      }
      await redis.del(failKey);
    }
  }

  await next();
}

export async function optionalAuth(c: Context<OmaEnv>, next: Next) {
  let rawKey: string | null = null;
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    rawKey = authHeader.slice(7);
  } else {
    const cookieHeader = c.req.header("Cookie") || "";
    const match = cookieHeader.match(/(?:^|;\s*)(?:__Host-)?oma_api_key=([^;]+)/);
    if (match) rawKey = decodeURIComponent(match[1]);
  }
  if (rawKey) {
    let apiKey: ApiKey | null;
    try {
      apiKey = (await validateApiKey(rawKey)) as ApiKey | null;
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : String(err), type: 'auth_validation_error' }, "[optionalAuth] validateApiKey threw");
      await next();
      return;
    }
    if (apiKey) {
      // ponytail: v7 H1 — enforce IP allowlist on optionalAuth too. Previously
      // a key with ipAllowlist set would be accepted from any IP if the route
      // used optionalAuth instead of bearerAuth.
      if (apiKey.ipAllowlist && Array.isArray(apiKey.ipAllowlist) && apiKey.ipAllowlist.length > 0) {
        const clientIp = extractClientIp(c);
        if (!isIpAllowedByList(clientIp, apiKey.ipAllowlist)) {
          // optionalAuth doesn't return errors — it just doesn't set the context.
          // Drop the key silently so the route treats the request as anonymous.
          await next();
          return;
        }
      }
      c.set("apiKey", apiKey);
      c.set("userId", apiKey.userId);
    }
  }
  await next();
}

export function requireTeamRole(...allowedRoles: string[]) {
  return async (c: Context<OmaEnv>, next: Next) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: { message: "Authentication required", type: "unauthorized" } }, 401);
    }

    const teamId = c.req.query("teamId") || c.req.header("X-Team-ID") || c.req.param("teamId");
    if (!teamId) {
      return c.json({ error: { message: "Team ID required", type: "bad_request", code: "team_id_required" } }, 400);
    }

    const [membership] = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)))
      .limit(1);

    if (!membership || !allowedRoles.includes(membership.role)) {
      return c.json({ error: { message: "Insufficient permissions", type: "forbidden" } }, 403);
    }

    c.set("teamRole", membership.role);
    await next();
  };
}

const PLATFORM_TEAM_ID = config.PLATFORM_TEAM_ID || "";

export function requireAdmin() {
  return async (c: Context<OmaEnv>, next: Next) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: { message: "Authentication required", type: "unauthorized" } }, 401);
    }

    if (ADMIN_WALLET_ADDRESSES_SET.size > 0) {
      const [user] = await db
        .select({ address: users.address })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (user?.address && ADMIN_WALLET_ADDRESSES_SET.has(user.address.toLowerCase())) {
        c.set("teamRole", "owner");
        await next();
        return;
      }
    }

    const teamId = PLATFORM_TEAM_ID || c.req.query("teamId") || c.req.header("X-Team-ID");
    if (!teamId) {
      return c.json({ error: { message: "Admin access required", type: "forbidden" } }, 403);
    }

    const [membership] = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)))
      .limit(1);

    if (!membership || !["admin", "owner"].includes(membership.role)) {
      return c.json({ error: { message: "Admin access required", type: "forbidden" } }, 403);
    }

    c.set("teamRole", membership.role);
    await next();
  };
}
