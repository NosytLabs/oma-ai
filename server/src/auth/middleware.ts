import type { Context, Next } from "hono";
import { validateApiKey, shouldRecommendRotation } from "./api-keys.js";
import { verifySessionToken } from "./siwe.js";
import { db } from "../db/client.js";
import { users, teamMembers } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { authenticator } from "@otplib/preset-default";
import { getRedisClient } from "../lib/redis-client.js";
import { config } from "../config.js";

const TWO_FA_FAILURES = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of TWO_FA_FAILURES) {
    if (entry.resetAt <= now) {
      TWO_FA_FAILURES.delete(key);
    }
  }
}, 60_000).unref();

export async function bearerAuth(c: Context<OmaEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: { message: "Missing or invalid Authorization header", type: "authentication_error" } }, 401);
  }
  const rawKey = authHeader.slice(7);
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
  const userId = await verifySessionToken(token);
  if (!userId) {
    return c.json({ error: { message: "Invalid or expired session token", type: "authentication_error" } }, 401);
  }
  c.set("userId", userId);

  const [user] = await db.select({ twoFactorEnabled: users.twoFactorEnabled }).from(users).where(eq(users.id, userId)).limit(1);
  if (user?.twoFactorEnabled) {
    const redis = await getRedisClient();
    const failKey = `2fa_fail:${userId}`;

    let failCount = 0;
    if (redis) {
      const failCountStr = await redis.get(failKey);
      failCount = failCountStr ? parseInt(String(failCountStr), 10) : 0;
    } else {
      const entry = TWO_FA_FAILURES.get(failKey);
      if (entry && entry.resetAt > Date.now()) {
        failCount = entry.count;
      } else if (entry) {
        TWO_FA_FAILURES.delete(failKey);
      }
    }

    if (failCount >= 5) {
      return c.json({ error: { message: "Too many 2FA attempts", type: "authentication_error", code: "2fa_brute_force" } }, 429);
    }

    const twoFactorCode = c.req.header("X-2FA-Code");
    if (!twoFactorCode) {
      return c.json({ error: { message: "2FA code required", type: "authentication_error", code: "2fa_required" } }, 401);
    }
    const [userWithSecret] = await db.select({ twoFactorSecret: users.twoFactorSecret }).from(users).where(eq(users.id, userId)).limit(1);
    if (userWithSecret?.twoFactorSecret) {
      const isValid = authenticator.verify({ token: twoFactorCode, secret: userWithSecret.twoFactorSecret });
      if (!isValid) {
        if (redis) {
          await redis.incr(failKey);
          await redis.expire(failKey, 300);
        } else {
          const entry = TWO_FA_FAILURES.get(failKey) || { count: 0, resetAt: Date.now() + 300_000 };
          entry.count += 1;
          entry.resetAt = Date.now() + 300_000;
          TWO_FA_FAILURES.set(failKey, entry);
        }
        return c.json({ error: { message: "Invalid 2FA code", type: "authentication_error" } }, 401);
      }
      if (redis) {
        await redis.del(failKey);
      } else {
        TWO_FA_FAILURES.delete(failKey);
      }
    }
  }

  await next();
}

export async function optionalAuth(c: Context<OmaEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7);
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

    if (config.ADMIN_WALLET_ADDRESSES) {
      const adminAddresses = config.ADMIN_WALLET_ADDRESSES.split(",").map((a) => a.trim().toLowerCase());
      const [user] = await db
        .select({ address: users.address })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (user?.address && adminAddresses.includes(user.address.toLowerCase())) {
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