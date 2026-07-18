import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getOrCreateUser, verifySiweMessage, getNonce, generateSessionToken, verifySessionToken } from "../auth/siwe.js";
import { unlinkWallet } from "../auth/wallet-link.js";
import { generateAccountNumber, hashAccountNumber } from "../auth/account-number.js";
import { createApiKey, listApiKeys, revokeApiKey, createApiKeyCookieHeader, createLogoutCookieHeader, updateModelAllowlist, getApiKey, validateApiKey } from "../auth/api-keys.js";
import { sessionAuth } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { extractClientIp } from "../middleware/rate-limit/utils.js";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { db } from "../db/client.js";
import { users, apiKeys, subscriptions, auditLogs, rateLimitOverrides } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { validationError } from "../lib/validation.js";
import type { OmaEnv } from "../types.js";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import {
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  regenerateBackupCodes,
  getTwoFactorStatus,
  getBackupCodeCount,
  TwoFactorError,
} from "../auth/two-factor.js";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

function generateCsrfToken(): string {
  const secret = config.CSRF_SECRET;
  if (!secret) {
    throw new Error("FATAL: CSRF_SECRET environment variable must be set. CSRF protection is disabled without it.");
  }
  const randomPart = randomBytes(32).toString('hex');
  const signature = createHmac('sha256', secret)
    .update(randomPart)
    .digest('hex');
  return `${randomPart}:${signature}`;
}

function validateCsrfToken(token: string, secret?: string): boolean {
  const csrfSecret = secret || config.CSRF_SECRET;
  if (!csrfSecret) {
    logger.error("[auth] CSRF_SECRET not configured - rejecting token validation");
    return false;
  }
  const parts = token.split(':');
  if (parts.length !== 2) return false;
  
  const [randomPart, signature] = parts;
  const expectedSignature = createHmac('sha256', csrfSecret)
    .update(randomPart)
    .digest('hex');
  
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return false;
  
  return true;
}

function createCsrfCookieHeader(token: string): string {
  // M5: hardcoded 1h cookie TTL moved to config.SESSION_COOKIE_TTL_MS
  const ttlMs = config.SESSION_COOKIE_TTL_MS;
  const expires = new Date(Date.now() + ttlMs).toUTCString();
  const maxAge = Math.floor(ttlMs / 1000);
  // H6 fix: use the `__Host-csrf_token` cookie name in production to match
  // the API-key pattern (`__Host-oma_api_key`). The `__Host-` prefix pins
  // the cookie to a specific host + path + Secure flag, preventing an
  // attacker who controls a subdomain (e.g. `evil.oma-ai.com`) from
  // forging a `csrf_token` cookie that the browser would attach to
  // requests on `oma-ai.com`. The matching client-side change is in
  // `app/src/lib/cookies.ts#CSRF_COOKIE_NAME`.
  const isProd = config.NODE_ENV === "production";
  const name = isProd ? "__Host-csrf_token" : "csrf_token";
  // Secure flag only on HTTPS / production. HTTP localhost dev needs the cookie
  // to be readable by the page so the login round-trip works in the browser.
  const secure = isProd ? " Secure;" : "";
  // ponytail: C1 — NO HttpOnly. Double-submit CSRF requires the browser to read
  // the cookie and echo it in the `x-csrf-token` header on state-changing
  // requests. HttpOnly blocks JS reads, which 403s every state change. Defense
  // in depth: SameSite=Strict + Secure (prod) + HMAC-signed body.
  return `${name}=${token}; expires=${expires}; path=/; max-age=${maxAge};${secure} SameSite=Strict`;
}

export const authRoutes = new Hono<OmaEnv>();

// Map a TwoFactorError (or unknown error) onto the standard JSON error
// envelope used by the rest of the auth surface. Unknown errors fall
// through to 500. The previous inline handlers used the same shape
// (error: { message, type }).
function twoFactorErrorResponse(c: Context, err: unknown) {
  if (err instanceof TwoFactorError) {
    return c.json(
      { error: { message: err.message, type: "invalid_request_error", code: err.code } },
      err.httpStatus,
    );
  }
  logger.error({ err }, "[auth/2fa] unexpected error");
  return c.json({ error: { message: "Internal server error", type: "internal_error" } }, 500);
}

const nonceSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const verifySchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
  type: z.enum(["siwe"]),
});

const walletSchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
});

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
});

const rateLimitOverrideSchema = z.object({
  rpm: z.number().min(1).optional(),
  tpm: z.number().min(100).optional(),
  expiresAt: z.string().datetime().optional(),
});

function buildStandaloneAccountAddress(accountNumber: string): string {
  return `account:${accountNumber}`;
}

async function allocateAccountNumber() {
  let accountNumber = generateAccountNumber();
  let attempts = 0;
  let collision = true;

  while (attempts < 10) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.accountNumberHash, hashAccountNumber(accountNumber)))
      .limit(1);
    if (existing.length === 0) {
      collision = false;
      break;
    }
    accountNumber = generateAccountNumber();
    attempts++;
  }

  if (collision) {
    throw new Error("Failed to generate unique account number");
  }

  return accountNumber;
}

async function ensureAccountNumber(user: { id: string; accountNumber: string | null }) {
  if (user.accountNumber) {
    return user.accountNumber;
  }

  const accountNumber = await allocateAccountNumber();

  const accountNumberHash = hashAccountNumber(accountNumber);
  await db.update(users).set({ accountNumber, accountNumberHash }).where(eq(users.id, user.id));
  return accountNumber;
}

authRoutes.post("/auth/nonce", rateLimit({ windowMs: 60_000, maxRequests: 20 }), async (c) => {
  const parsed = nonceSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { address } = parsed.data;
  const nonce = await getNonce(address);
  return c.json({ nonce });
});

authRoutes.post("/auth/verify", rateLimit({ windowMs: 60_000, maxRequests: 20 }), async (c) => {
  const parsed = verifySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { message, signature } = parsed.data;
  const verified = await verifySiweMessage(message, signature);
  if (!verified) return c.json({ error: { message: "SIWE verification failed", type: "authentication_error" } }, 401);
  const user = await getOrCreateUser(verified.address);

  let accountNumber: string;
  try {
    accountNumber = await ensureAccountNumber(user);
  } catch {
    return c.json({ error: { message: "Failed to generate unique account number", type: "internal_error" } }, 500);
  }

  const token = await generateSessionToken(user.id, "siwe");
  // ponytail: include the canonical user payload so the client doesn't
  // need to immediately call /user after a successful verify. The shape
  // matches the /user endpoint response.
  return c.json({
    token,
    address: user.address,
    evmAddress: user.evmAddress,
    accountNumber,
    authMethod: "siwe",
    user: {
      id: user.id,
      address: user.address,
      evmAddress: user.evmAddress,
      accountNumber,
      createdAt: user.createdAt,
    },
  });
});

authRoutes.post("/auth/wallet", rateLimit({ windowMs: 60_000, maxRequests: 20 }), async (c) => {
  const parsed = walletSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { message, signature } = parsed.data;
  const verified = await verifySiweMessage(message, signature);
  if (!verified) return c.json({ error: { message: "SIWE verification failed", type: "authentication_error" } }, 401);
  const user = await getOrCreateUser(verified.address);

  // Check if user already has a default wallet key
  const existingKeys = await listApiKeys(user.id);
  const existingWalletKey = existingKeys.find(k => k.name === "Default wallet key" && k.active);

  if (existingWalletKey) {
    // User already has a wallet key - return existing key metadata (plaintext not recoverable)
    return c.json({
      apiKey: null, // Plaintext never stored, cannot be recovered
      id: existingWalletKey.id,
      name: existingWalletKey.name,
      prefix: existingWalletKey.keyPrefix,
      createdAt: existingWalletKey.createdAt,
      warning: "API key already exists. Use existing key or generate new one via POST /auth/keys"
    }, 200);
  }

  // First wallet connect - generate and return new API key (returned ONCE)
  const apiKey = await createApiKey(user.id, "Default wallet key");
  return c.json({
    apiKey: apiKey.key,
    prefix: apiKey.prefix,
    id: apiKey.id,
    name: apiKey.name,
    createdAt: apiKey.createdAt
  }, 201);
});

// ============================================================
// Wallet unlinking (deletes the wallet link for a user)
// ============================================================
authRoutes.delete("/auth/wallet/:type", sessionAuth, async (c) => {
  const userId = c.get("userId") as string;
  const { type } = c.req.param();

  if (type !== "evm") {
    return c.json({ error: { message: "Invalid wallet type. Use 'evm'.", type: "invalid_request_error" } }, 400);
  }

  try {
    const snapshot = await unlinkWallet(userId, type);
    return c.json({
      unlinked: true,
      message: `${type} wallet unlinked`,
      accountSnapshot: snapshot,
    });
  } catch (err) {
    if (err instanceof Error && "httpStatus" in err) {
      const walletErr = err as unknown as { message: string; httpStatus: number; code: string };
      return c.json({ error: { message: walletErr.message, type: "invalid_request_error", code: walletErr.code } }, walletErr.httpStatus as 400 | 401 | 404 | 409 | 500);
    }
    return c.json({ error: { message: "Failed to unlink wallet", type: "server_error" } }, 500);
  }
});

authRoutes.get("/user", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const authMethod = c.get("authMethod");
  const [user] = await db.select({
    id: users.id,
    address: users.address,
    evmAddress: users.evmAddress,
    accountNumber: users.accountNumber,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: { message: "User not found", type: "not_found" } }, 404);
  return c.json({ ...user, authMethod });
});

authRoutes.delete("/account", sessionAuth, async (c) => {
  const userId = c.get("userId");
  await db.transaction(async (tx) => {
    await tx.delete(apiKeys).where(eq(apiKeys.userId, userId));
    await tx.update(subscriptions).set({ status: "canceled" }).where(eq(subscriptions.userId, userId));
    await tx.insert(auditLogs).values({
      userId,
      action: "USER_DELETED",
      resource: "users",
      resourceId: userId,
      metadata: JSON.stringify({ deletedAt: new Date().toISOString() }),
      createdAt: new Date(),
    });
    await tx.delete(users).where(eq(users.id, userId));
  });
  return c.json({ success: true });
});

authRoutes.post("/auth/logout", sessionAuth, async (c) => {
  // L-A4 + C1 fix: clear the canonical session cookie so a logged-out
  // user can't keep using the JWT. After C1 the cookie is HttpOnly
  // (set server-side by /api/auth/session/cookie, no longer written
  // via document.cookie), so JS cannot delete it client-side — this
  // server-side Set-Cookie is the only way to expire it. The name
  // matches the new env-dependent SESSION_COOKIE_NAME in
  // `app/src/lib/cookies.ts` so logout actually clears the cookie
  // the login flow set (C2 fix for the previous prod/dev name
  // mismatch where the user thought they were logged out but the
  // HttpOnly __Host-oma_session cookie survived).
  const isDev = config.NODE_ENV === "development";
  const name = isDev ? "oma_session" : "__Host-oma_session";
  let clearCookie = `${name}=; Path=/; SameSite=Strict; Max-Age=0`;
  if (!isDev) clearCookie += "; Secure";
  c.header("Set-Cookie", clearCookie);
  return c.json({ success: true });
});

authRoutes.post("/auth/2fa/setup", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const [user] = await db
    .select({ address: users.address, accountNumber: users.accountNumber })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return c.json({ error: { message: "User not found", type: "not_found" } }, 404);

  // ponytail: post-0030 the address column is nullable (account-only users
  // have no wallet). 2FA setup requires *some* user identifier to bind the
  // authenticator to; fall back to the account number when no address is set.
  const userLabel = user.address ?? user.accountNumber ?? `account:${userId}`;

  try {
    const payload = await setupTwoFactor(userId, userLabel);
    return c.json({
      secret: payload.secret,
      otpauthUri: payload.otpauthUri,
      qrCodeDataUrl: payload.qrCodeDataUrl,
      backupCodes: payload.backupCodes,
    });
  } catch (err) {
    return twoFactorErrorResponse(c, err);
  }
});

authRoutes.post("/auth/2fa/verify", sessionAuth, async (c) => {
  const parsed = z.object({ code: z.string().min(6).max(6) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { code } = parsed.data;
  const userId = c.get("userId");

  try {
    await enableTwoFactor(userId, code);
    return c.json({ success: true, message: "2FA enabled" });
  } catch (err) {
    return twoFactorErrorResponse(c, err);
  }
});

authRoutes.post("/auth/2fa/disable", sessionAuth, async (c) => {
  // ponytail: previously required a `password` field that was never validated
  // (dead code). Removed — 2FA disable is gated by session auth + valid TOTP
  // or backup code via the auth/two-factor helper.
  const parsed = z
    .object({
      code: z.string().min(1),
      isBackupCode: z.boolean().optional().default(false),
    })
    .safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { code, isBackupCode } = parsed.data;
  const userId = c.get("userId");

  try {
    await disableTwoFactor(userId, code, isBackupCode);
    return c.json({ success: true, message: "2FA disabled" });
  } catch (err) {
    return twoFactorErrorResponse(c, err);
  }
});

// GET: return the count of unused 2FA backup codes for the current user.
// The plaintext codes are shown EXACTLY ONCE at setup time (returned by
// /auth/2fa/setup) — they cannot be recovered afterwards because they're
// stored hashed at rest. To roll new codes, call POST /auth/2fa/backup-codes.
authRoutes.get("/auth/2fa/backup-codes", sessionAuth, async (c) => {
  const userId = c.get("userId");
  try {
    const remaining = await getBackupCodeCount(userId);
    return c.json({ remaining });
  } catch (err) {
    return twoFactorErrorResponse(c, err);
  }
});

// Regenerate the user's 2FA backup codes. Gated by session auth and the
// current TOTP code (a backup code would be circular — they prove possession
// of *some* 2FA factor, but not of the live device). Returns the new
// plaintext codes EXACTLY ONCE.
authRoutes.post("/auth/2fa/backup-codes", sessionAuth, async (c) => {
  const parsed = z.object({ code: z.string().min(6).max(6) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { code } = parsed.data;
  const userId = c.get("userId");

  try {
    const result = await regenerateBackupCodes(userId, code);
    return c.json({ backupCodes: result.backupCodes });
  } catch (err) {
    return twoFactorErrorResponse(c, err);
  }
});

authRoutes.get("/auth/2fa/status", sessionAuth, async (c) => {
  const userId = c.get("userId");
  try {
    const status = await getTwoFactorStatus(userId);
    return c.json(status);
  } catch (err) {
    return twoFactorErrorResponse(c, err);
  }
});

// Account-number auth (16-digit)
authRoutes.post("/auth/account/create", rateLimit({ windowMs: 60_000, maxRequests: 5 }), async (c) => {
  // H3 fix: enforce the same double-submit CSRF pattern as
  // /auth/account/login. Previously this endpoint only had rate limiting
  // and an optional Bearer session — a cross-site form submission could
  // hit the unauthenticated path (allocateAccountNumber + insert user
  // row) and mint a fresh JWT for the attacker's chosen account number.
  // Now we require the same csrf_token cookie + x-csrf-token header +
  // HMAC-validated token that login already uses. The session-mode path
  // is also gated so a cross-site request that piggybacks on an existing
  // session cookie still fails the CSRF check.
  const csrfToken = c.req.header("x-csrf-token");
  const cookieHeader = c.req.header("Cookie") || "";
  const csrfCookieMatch = cookieHeader.match(/(?:^|;\s*)(?:__Host-)?csrf_token=([^;]+)/);
  const csrfCookie = csrfCookieMatch ? csrfCookieMatch[1] : null;
  const csrfValid = csrfToken && csrfCookie &&
    csrfToken.length === csrfCookie.length &&
    timingSafeEqual(Buffer.from(csrfToken), Buffer.from(csrfCookie));
  if (!csrfValid || !validateCsrfToken(csrfToken ?? "")) {
    return c.json({ error: { message: "Invalid CSRF token", type: "csrf_error", code: "csrf_validation_failed" } }, 403);
  }

  const authHeader = c.req.header("Authorization");
  const session = authHeader?.startsWith("Bearer ")
    ? await verifySessionToken(authHeader.slice(7))
    : null;

  if (authHeader?.startsWith("Bearer ") && !session) {
    return c.json({ error: { message: "Invalid or expired session token", type: "authentication_error" } }, 401);
  }

  if (session) {
    const [user] = await db
      .select({ id: users.id, accountNumber: users.accountNumber })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) {
      return c.json({ error: { message: "User not found", type: "not_found" } }, 404);
    }

    if (user.accountNumber) {
      return c.json({ error: { message: "Account number already exists", type: "invalid_request_error" } }, 400);
    }

    try {
      const accountNumber = await ensureAccountNumber(user);
      return c.json({ accountNumber, authMethod: session.authMethod });
    } catch {
      return c.json({ error: { message: "Failed to generate unique account number", type: "internal_error" } }, 500);
    }
  }

  let accountNumber: string;
  try {
    accountNumber = await allocateAccountNumber();
  } catch {
    return c.json({ error: { message: "Failed to generate unique account number", type: "internal_error" } }, 500);
  }

  const accountNumberHash = hashAccountNumber(accountNumber);
  const inserted = await db
    .insert(users)
    .values({
      address: buildStandaloneAccountAddress(accountNumber),
      accountNumber,
      accountNumberHash,
      nonce: nanoid(32),
    })
    .returning({ id: users.id, accountNumber: users.accountNumber });

  const [user] = inserted;
  const token = await generateSessionToken(user.id, "account-number");
  return c.json({ token, accountNumber: user.accountNumber, authMethod: "account-number" }, 201);
});

const csrfTokenHandler: MiddlewareHandler<OmaEnv> = async (c) => {
  const token = generateCsrfToken();
  c.header("Set-Cookie", createCsrfCookieHeader(token));
  return c.json({ token });
};

authRoutes.post("/auth/csrf-token", rateLimit({ windowMs: 60_000, maxRequests: 60 }), csrfTokenHandler);

authRoutes.post("/auth/account/login", async (c) => {
  const ip = extractClientIp(c);
  const key = `rl:account-login:ip:${ip}`;

  const redis = await getRedisClient();
  const ready = isRedisReady();

  if (!redis || !ready) {
    return c.json({ error: { message: "Service temporarily unavailable", type: "rate_limit_error", code: "service_unavailable" } }, 503);
  }

  // Sliding window rate limiting using Redis sorted set (ZSET).
  // This provides true sliding window behavior vs the previous fixed window.
  // Algorithm: ZREMRANGEBYSCORE (remove expired) -> ZADD (add current) -> ZCARD (count)
  const windowMs = 60_000; // 60 seconds
  const maxRequests = 5;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // 1. Remove expired entries outside the sliding window
    await redis.zRemRangeByScore(key, 0, windowStart);

    // 2. Count current requests in window
    const currentCount = await redis.zCard(key);

    if (currentCount >= maxRequests) {
      // Use fixed retry-after for simplicity (the window is 60s)
      const retryAfter = 60;

      await db.insert(auditLogs).values({
        userId: null,
        action: "ACCOUNT_LOGIN_RATE_LIMITED",
        resource: "auth",
        resourceId: null,
        ipAddress: ip,
        metadata: JSON.stringify({ ip, count: currentCount }),
        createdAt: new Date(),
      }).catch((err) => {
        logger.warn({ err, ip }, "Failed to write ACCOUNT_LOGIN_RATE_LIMITED audit log");
      });

      c.header("Retry-After", String(Math.max(retryAfter, 1)));
      return c.json(
        { error: { message: "Too many login attempts. Try again later.", type: "rate_limit_error", code: "rate_limit_exceeded" } },
        429,
      );
    }

    // 3. Add current request with timestamp as score and unique member
    const member = `${now}:${Math.random().toString(36).slice(2)}`;
    await redis.zAdd(key, { score: now, value: member });
    // Set expiry to windowMs + buffer to clean up abandoned keys
    await redis.expire(key, Math.ceil(windowMs / 1000) + 10);

    const remaining = maxRequests - currentCount - 1;
    c.header("X-RateLimit-Limit", String(maxRequests));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
  } catch (err) {
    logger.error({ err, ip }, "Sliding window rate limit error for account login");
    return c.json(
      { error: { message: "Service temporarily unavailable. Please try again later.", type: "rate_limit_error", code: "service_unavailable" } },
      503,
    );
  }

  const csrfToken = c.req.header("x-csrf-token");
  const cookieHeader = c.req.header("Cookie") || "";
  // H6 fix: cookie name is `__Host-csrf_token` in production (set by
  // createCsrfCookieHeader above) and `csrf_token` in dev. The optional
  // prefix in the regex matches both without forcing a per-env branch
  // here. The same regex is used by the new CSRF check in
  // /auth/account/create below.
  const csrfCookieMatch = cookieHeader.match(/(?:^|;\s*)(?:__Host-)?csrf_token=([^;]+)/);
  const csrfCookie = csrfCookieMatch ? csrfCookieMatch[1] : null;
  
  // C6: Use timing-safe comparison for CSRF cookie vs header match
  const csrfValid = csrfToken && csrfCookie &&
    csrfToken.length === csrfCookie.length &&
    timingSafeEqual(Buffer.from(csrfToken), Buffer.from(csrfCookie));
  if (!csrfValid) {
    return c.json({ error: { message: "Invalid CSRF token", type: "csrf_error", code: "csrf_validation_failed" } }, 403);
  }
  
  if (!validateCsrfToken(csrfToken)) {
    return c.json({ error: { message: "Invalid or expired CSRF token", type: "csrf_error", code: "csrf_validation_failed" } }, 403);
  }
  
  const schema = z.object({ accountNumber: z.string().min(1) });
  const parsed = schema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  
  const { accountNumber } = parsed.data;
  const accountNumberHash = hashAccountNumber(accountNumber.toUpperCase());
  
  const [user] = await db.select({ id: users.id, address: users.address, accountNumber: users.accountNumber }).from(users).where(eq(users.accountNumberHash, accountNumberHash)).limit(1);
  if (!user) return c.json({ error: { message: "Invalid account number", type: "authentication_error" } }, 401);
  
  // Auto-create account number if user doesn't have one (edge case: migrated user)
  let newAccountNumber = user.accountNumber;
  if (!newAccountNumber) {
    try {
      newAccountNumber = await allocateAccountNumber();
    } catch {
      return c.json({ error: { message: "Failed to generate unique account number", type: "internal_error" } }, 500);
    }
    const newHash = hashAccountNumber(newAccountNumber);
    await db.update(users).set({ accountNumber: newAccountNumber, accountNumberHash: newHash }).where(eq(users.id, user.id));
  }
  
  const token = await generateSessionToken(user.id, "account-number");
  return c.json({ token, address: user.address, accountNumber: newAccountNumber, authMethod: "account-number", hasApiKey: true });
});

authRoutes.get("/keys", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const keys = await listApiKeys(userId);
  return c.json({ keys });
});

authRoutes.post("/keys", sessionAuth, async (c) => {
  const parsed = createKeySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const userId = c.get("userId");
  const { name } = parsed.data;
  const result = await createApiKey(userId, name);
  return c.json({ key: result.key, prefix: result.prefix, id: result.id ?? "", name: result.name, createdAt: result.createdAt }, 201);
});

authRoutes.delete("/keys/:id", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("id") ?? "";
  const result = await revokeApiKey(String(userId), keyId);
  if (!result) return c.json({ error: { message: "API key not found", type: "not_found" } }, 404);
  return c.json({ success: true });
});

authRoutes.patch("/keys/:id", sessionAuth, async (c) => {
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

authRoutes.post("/auth/api-key/cookie", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = z.object({ apiKey: z.string().min(1) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { apiKey } = parsed.data;

  // SEC-10: ownership check — we must validate the API key belongs to this
  // user before storing it as a cookie. Without this check, User A could set
  // a cookie with User B's known API key and impersonate B for API calls.
  const ownerKey = await getApiKey(userId, apiKey);
  if (!ownerKey) {
    // Fallback: also try validateApiKey which does a full lookup by hash.
    // getApiKey expects (userId, keyId) — but a raw key string isn't keyId,
    // so it only matches when the caller passes the actual key ID.
    const validated = await validateApiKey(apiKey);
    if (!validated || validated.userId !== userId) {
      return c.json({ error: { message: "API key not found or does not belong to this account", type: "invalid_request_error" } }, 404);
    }
  }

  const cookieHeader = createApiKeyCookieHeader(apiKey);
  c.header("Set-Cookie", cookieHeader);

  return c.json({ success: true });
});

authRoutes.get("/keys/:id/allowlist", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("id") ?? "";
  const entry = await getApiKey(userId, keyId);
  if (!entry) return c.json({ error: { message: "API key not found", type: "not_found" } }, 404);
  return c.json({ models: entry.allowedModels ?? [] });
});

authRoutes.patch("/keys/:id/allowlist", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("id") ?? "";
  const parsed = z.object({ models: z.array(z.string()).default([]) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const result = await updateModelAllowlist(keyId, userId, parsed.data.models);
  if (!result) return c.json({ error: { message: "API key not found", type: "not_found" } }, 404);
  return c.json({ models: result.allowedModels ?? [] });
});

authRoutes.delete("/auth/api-key/cookie", sessionAuth, async (_c) => {
  const cookieHeader = createLogoutCookieHeader();
  _c.header("Set-Cookie", cookieHeader);
  return _c.json({ success: true });
});
