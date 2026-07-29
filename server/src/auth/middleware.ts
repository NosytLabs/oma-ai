/**
 * Auth middleware for Hono routes.
 *
 * Two independent paths:
 *
 *   bearerAuth          — API key auth (Authorization: Bearer oma_sk_… or
 *                         the HttpOnly oma_api_key cookie). Used for the
 *                         OpenAI-compatible /v1/* gateway surface.
 *
 *   sessionAuth         — Better Auth session cookie. The Next.js middleware
 *                         decodes the HttpOnly cookie; this middleware
 *                         re-verifies it on the server side by calling the
 *                         Better Auth API. Used for dashboard / settings /
 *                         /admin.
 *
 *   sessionOrBearerAuth — accept either (used on /v1/usage and friends where
 *                         a logged-in dashboard user OR a CLI key should
 *                         both work).
 *
 * The legacy JWT (HS256) verifySessionToken path was REMOVED in this
 * rebuild — Better Auth signs the session cookie itself.
 */
import type { Context, Next } from "hono";
import {
  validateApiKey,
  isIpAllowedByList,
  shouldRecommendRotation,
} from "./api-keys.js";
import { auth } from "../auth.js";
import type { OmaEnv } from "../types.js";
import type { ApiKey } from "../db/schema.js";
import { config, ADMIN_WALLET_ADDRESSES_SET } from "../config.js";
import { extractClientIp } from "../middleware/rate-limit/utils.js";
import { logger } from "../lib/logger.js";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { user } from "../db/schema.js";

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function isValidEthereumAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address);
}

export function initAuth(): void {
  const validProductionEnvironments = ["production", "staging", "preview"];
  if (!validProductionEnvironments.includes(config.NODE_ENV)) return;
  if (!config.ADMIN_WALLET_ADDRESSES) return;

  const addresses = config.ADMIN_WALLET_ADDRESSES.split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  for (const address of addresses) {
    if (!isValidEthereumAddress(address)) {
      logger.fatal(
        { address },
        "[FATAL] ADMIN_WALLET_ADDRESSES contains invalid Ethereum address",
      );
      process.exit(1);
    }
  }
}

// SEC-7: singleflight dedup. Concurrent requests for the same key share
// one in-flight validateApiKey() promise so the underlying DB transaction
// (with its SELECT ... FOR UPDATE + lastUsedAt write) runs at most once
// per key.
type SingleflightRecord = { promise: Promise<unknown> };
const singleflightInflight = new Map<string, SingleflightRecord>();

async function singleflight<T>(
  key: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  const existing = singleflightInflight.get(key);
  if (existing) return existing.promise as Promise<T>;
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
  let rawKey: string | null = null;
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    rawKey = authHeader.slice(7);
  } else {
    const cookieHeader = c.req.header("Cookie") || "";
    const match = cookieHeader.match(
      /(?:^|;\s*)(?:__Host-)?oma_api_key=([^;]+)/,
    );
    if (match) rawKey = decodeURIComponent(match[1]);
  }
  if (!rawKey) {
    return c.json(
      {
        error: {
          message: "Missing or invalid Authorization header",
          type: "authentication_error",
        },
      },
      401,
    );
  }

  let apiKey: ApiKey | null;
  try {
    apiKey = (await singleflight(`apikey:${rawKey}`, () =>
      validateApiKey(rawKey!),
    )) as ApiKey | null;
  } catch (err) {
    logger.error(
      {
        err: err instanceof Error ? err.message : String(err),
        type: "auth_validation_error",
      },
      "[bearerAuth] validateApiKey threw",
    );
    return c.json(
      {
        error: { message: "Invalid API key", type: "authentication_error" },
      },
      401,
    );
  }

  if (!apiKey) {
    return c.json(
      {
        error: { message: "Invalid API key", type: "authentication_error" },
      },
      401,
    );
  }
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return c.json(
      {
        error: {
          message: "API key expired",
          type: "authentication_error",
          code: "expired_api_key",
        },
      },
      401,
    );
  }
  if (apiKey.ipAllowlist && apiKey.ipAllowlist.length > 0) {
    const clientIp = extractClientIp(c);
    if (!isIpAllowedByList(clientIp, apiKey.ipAllowlist)) {
      return c.json(
        {
          error: {
            message: "IP not allowed for this API key",
            type: "forbidden",
            code: "ip_not_allowed",
          },
        },
        403,
      );
    }
  }
  c.set("apiKey", apiKey);
  c.set("userId", apiKey.userId);
  if (apiKey.createdAt && shouldRecommendRotation(new Date(apiKey.createdAt))) {
    c.res.headers.set("X-Key-Rotation-Recommended", "true");
  }
  await next();
}

/**
 * Better Auth session middleware. Reads the HttpOnly session cookie set by
 * the Better Auth handler and resolves it to a { userId, session } pair
 * via `auth.api.getSession`. Sets the same Hono context keys as bearerAuth
 * so downstream route handlers don't have to care which path was used.
 */
export async function sessionAuth(c: Context<OmaEnv>, next: Next) {
  const headers = new Headers();
  for (const [k, v] of c.req.raw.headers) headers.set(k, v);
  const session = await auth.api.getSession({ headers });
  if (!session?.user) {
    return c.json(
      {
        error: {
          message: "Unauthorized",
          type: "authentication_error",
        },
      },
      401,
    );
  }
  c.set("userId", session.user.id);
  c.set("session", session.session);
  c.set("user", session.user);
  await next();
}

/**
 * Accept either a Better Auth session cookie OR an API key. Used on
 * endpoints that work for both browser users (dashboard) and CLI / agents
 * (Bearer key).
 */
export async function sessionOrBearerAuth(
  c: Context<OmaEnv>,
  next: Next,
) {
  // Try session first.
  const headers = new Headers();
  for (const [k, v] of c.req.raw.headers) headers.set(k, v);
  const session = await auth.api.getSession({ headers });
  if (session?.user) {
    c.set("userId", session.user.id);
    c.set("session", session.session);
    c.set("user", session.user);
    await next();
    return;
  }
  // Fall through to API key.
  return bearerAuth(c, next);
}

export async function optionalAuth(c: Context<OmaEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7);
    let apiKey: ApiKey | null;
    try {
      apiKey = (await singleflight(`apikey:${rawKey}`, () =>
        validateApiKey(rawKey!),
      )) as ApiKey | null;
    } catch {
      await next();
      return;
    }
    if (apiKey) {
      if (
        apiKey.ipAllowlist &&
        Array.isArray(apiKey.ipAllowlist) &&
        apiKey.ipAllowlist.length > 0
      ) {
        const clientIp = extractClientIp(c);
        if (!isIpAllowedByList(clientIp, apiKey.ipAllowlist)) {
          await next();
          return;
        }
      }
      c.set("apiKey", apiKey);
      c.set("userId", apiKey.userId);
    }
    return next();
  }
  // No Bearer — check for session cookie
  const headers = new Headers();
  for (const [k, v] of c.req.raw.headers) headers.set(k, v);
  const session = await auth.api.getSession({ headers });
  if (session?.user) {
    c.set("userId", session.user.id);
    c.set("session", session.session);
    c.set("user", session.user);
  }
  await next();
}

export function requireAdmin() {
  return async (c: Context<OmaEnv>, next: Next) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json(
        {
          error: { message: "Authentication required", type: "unauthorized" },
        },
        401,
      );
    }

    if (ADMIN_WALLET_ADDRESSES_SET.size > 0) {
      const [u] = await db
        .select({ evmAddress: user.evmAddress })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      if (
        u?.evmAddress &&
        ADMIN_WALLET_ADDRESSES_SET.has(u.evmAddress.toLowerCase())
      ) {
        c.set("teamRole", "owner");
        await next();
        return;
      }
    }

    return c.json(
      {
        error: { message: "Admin access required", type: "forbidden" },
      },
      403,
    );
  };
}
