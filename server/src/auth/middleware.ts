import type { Context, Next } from "hono";
import { validateApiKey, shouldRecommendRotation } from "./api-keys.js";
import { verifySessionToken } from "./siwe.js";
import { decryptSecret } from "./encryption.js";
import { db } from "../db/client.js";
import { users, teamMembers } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { authenticator } from "@otplib/preset-default";
import { getRedisClient } from "../lib/redis-client.js";
import { config, ADMIN_WALLET_ADDRESSES_SET } from "../config.js";

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
  const apiKey = await validateApiKey(rawKey);
  if (!apiKey) {
    return c.json({ error: { message: "Invalid API key", type: "authentication_error" } }, 401);
  }
  if (apiKey.expired) {
    return c.json({ error: { message: "API key expired", type: "authentication_error", code: "expired_api_key" } }, 401);
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
  const session = await verifySessionToken(token);
  if (!session) {
    return c.json({ error: { message: "Invalid or expired session token", type: "authentication_error" } }, 401);
  }
  c.set("userId", session.userId);
  c.set("authMethod", session.authMethod);

  const [user] = await db.select({ twoFactorEnabled: users.twoFactorEnabled }).from(users).where(eq(users.id, session.userId)).limit(1);
  if (user?.twoFactorEnabled) {
    const redis = await getRedisClient();
    if (!redis) {
      return c.json({ error: { message: "Authentication service unavailable", type: "server_error" } }, 503);
    }
    const failKey = `2fa_fail:${session.userId}`;

    const failCountStr = await redis.get(failKey);
    const failCount = failCountStr ? parseInt(String(failCountStr), 10) : 0;

    if (failCount >= 5) {
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
        await redis.incr(failKey);
        await redis.expire(failKey, 300);
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
    const apiKey = await validateApiKey(rawKey);
    if (apiKey) {
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
