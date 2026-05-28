import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getOrCreateUser, verifySiweMessage, getNonce, generateSessionToken, verifySessionToken } from "../auth/siwe.js";
import { createSolanaChallenge, getOrCreateSolanaUser, verifySolanaChallenge } from "../auth/solana.js";
import { createApiKey, listApiKeys, revokeApiKey, createApiKeyCookieHeader, createLogoutCookieHeader } from "../auth/api-keys.js";
import { sessionAuth } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { extractClientIp } from "../middleware/rate-limit/utils.js";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { db } from "../db/client.js";
import { users, apiKeys, subscriptions, auditLogs } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { validationError } from "../lib/validation.js";
import type { OmaEnv } from "../types.js";
import { createHash, randomBytes, createHmac, timingSafeEqual } from "crypto";
import { authenticator } from "@otplib/preset-default";
import { encryptSecret, decryptSecret } from "../auth/encryption.js";
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
    console.error("[auth] CSRF_SECRET not configured - rejecting token validation");
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
  const expires = new Date(Date.now() + 3600000).toUTCString();
  return `csrf_token=${token}; expires=${expires}; path=/; max-age=3600; HttpOnly; Secure; SameSite=Strict`;
}

function generateAccountNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = [];
  for (let i = 0; i < 3; i++) {
    let segment = "";
    for (let j = 0; j < 4; j++) {
      segment += chars[randomBytes(1)[0] % chars.length];
    }
    segments.push(segment);
  }
  return `OMA-${segments.join("-")}`;
}

function hashAccountNumber(accountNumber: string): string {
  return createHash("sha256").update(accountNumber.toUpperCase()).digest("hex");
}

export const authRoutes = new Hono<OmaEnv>();

const nonceSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$|^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
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

const solanaAddressSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

const solanaChallengeSchema = z.object({
  address: solanaAddressSchema,
});

const solanaVerifySchema = z.object({
  address: solanaAddressSchema,
  message: z.string().min(1),
  signature: z.string().min(1),
});

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
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
  return c.json({ token, address: user.address, accountNumber, authMethod: "siwe" });
});

authRoutes.post("/auth/solana/challenge", rateLimit({ windowMs: 60_000, maxRequests: 20 }), async (c) => {
  const parsed = solanaChallengeSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  try {
    const challenge = await createSolanaChallenge(parsed.data.address);
    return c.json(challenge);
  } catch {
    return c.json({ error: { message: "Invalid Solana address", type: "validation_error" } }, 400);
  }
});

authRoutes.post("/auth/solana/verify", rateLimit({ windowMs: 60_000, maxRequests: 20 }), async (c) => {
  const parsed = solanaVerifySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const verified = await verifySolanaChallenge(parsed.data.address, parsed.data.message, parsed.data.signature);
  if (!verified) {
    return c.json({ error: { message: "Solana verification failed", type: "authentication_error" } }, 401);
  }

  const user = await getOrCreateSolanaUser(verified.address);

  let accountNumber: string;
  try {
    accountNumber = await ensureAccountNumber(user);
  } catch {
    return c.json({ error: { message: "Failed to generate unique account number", type: "internal_error" } }, 500);
  }

  const token = await generateSessionToken(user.id, "solana");
  return c.json({
    token,
    address: user.address,
    solanaAddress: user.solanaAddress ?? verified.address,
    accountNumber,
    authMethod: "solana",
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

authRoutes.get("/user", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const authMethod = c.get("authMethod");
  const [user] = await db.select({
    id: users.id,
    address: users.address,
    solanaAddress: users.solanaAddress,
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

authRoutes.post("/auth/logout", sessionAuth, async (c) => c.json({ success: true }));

authRoutes.post("/auth/2fa/setup", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const [user] = await db.select({ address: users.address }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: { message: "User not found", type: "not_found" } }, 404);

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.address, "OMA", secret);

  const { encrypted, iv, authTag } = encryptSecret(secret);
  await db.update(users).set({ twoFactorSecret: JSON.stringify({ encrypted, iv, authTag }) }).where(eq(users.id, userId));

  return c.json({ secret, otpauth });
});

authRoutes.post("/auth/2fa/verify", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = z.object({ code: z.string().min(6).max(6) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { code } = parsed.data;

  const [user] = await db.select({ twoFactorSecret: users.twoFactorSecret }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.twoFactorSecret) return c.json({ error: { message: "2FA not set up", type: "invalid_request_error" } }, 400);

  let secret: string;
  try {
    const parsed = JSON.parse(user.twoFactorSecret);
    secret = decryptSecret(parsed.encrypted, parsed.iv, parsed.authTag);
  } catch {
    return c.json({ error: { message: "Failed to decrypt 2FA secret", type: "internal_error" } }, 500);
  }

  const isValid = authenticator.verify({ token: code, secret });
  if (!isValid) return c.json({ error: { message: "Invalid 2FA code", type: "authentication_error" } }, 401);

  await db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, userId));
  return c.json({ success: true, message: "2FA enabled" });
});

authRoutes.post("/auth/2fa/disable", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = z.object({ password: z.string().min(1), code: z.string().min(6).max(6) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { code } = parsed.data;

  const [user] = await db.select({ twoFactorSecret: users.twoFactorSecret, twoFactorEnabled: users.twoFactorEnabled }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.twoFactorEnabled) return c.json({ error: { message: "2FA not enabled", type: "invalid_request_error" } }, 400);

  let secret: string;
  try {
    const parsed = JSON.parse(user.twoFactorSecret!);
    secret = decryptSecret(parsed.encrypted, parsed.iv, parsed.authTag);
  } catch {
    return c.json({ error: { message: "Failed to decrypt 2FA secret", type: "internal_error" } }, 500);
  }

  const isCodeValid = authenticator.verify({ token: code, secret });
  if (!isCodeValid) return c.json({ error: { message: "Invalid 2FA code", type: "authentication_error" } }, 401);

  await db.update(users).set({ twoFactorEnabled: false, twoFactorSecret: null }).where(eq(users.id, userId));
  return c.json({ success: true, message: "2FA disabled" });
});

authRoutes.get("/auth/2fa/status", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const [user] = await db.select({ twoFactorEnabled: users.twoFactorEnabled }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: { message: "User not found", type: "not_found" } }, 404);
  return c.json({ enabled: user.twoFactorEnabled });
});

// Account-number auth (Mullvad-style)
authRoutes.post("/auth/account/create", rateLimit({ windowMs: 60_000, maxRequests: 5 }), async (c) => {
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

authRoutes.get("/auth/csrf-token", async (c) => {
  const token = generateCsrfToken();
  c.header("Set-Cookie", createCsrfCookieHeader(token));
  return c.json({ token });
});

authRoutes.post("/auth/account/login", async (c, next) => {
  const ip = extractClientIp(c);
  const key = `rl:account-login:ip:${ip}`;

  const redis = await getRedisClient();
  const ready = isRedisReady();

  if (!redis || !ready) {
    return c.json({ error: { message: "Service temporarily unavailable", type: "rate_limit_error", code: "service_unavailable" } }, 503);
  }

  try {
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, 60);
    const ttl = await redis.ttl(key);

    if (current > 5) {
      await db.insert(auditLogs).values({
        userId: null,
        action: "ACCOUNT_LOGIN_RATE_LIMITED",
        resource: "auth",
        resourceId: null,
        ipAddress: ip,
        metadata: JSON.stringify({ ip, count: current - 1 }),
        createdAt: new Date(),
      }).catch((err) => {
        logger.warn({ err, ip }, "Failed to write ACCOUNT_LOGIN_RATE_LIMITED audit log");
      });
      c.header("Retry-After", String(Math.max(ttl, 1)));
      return c.json({ error: { message: "Too many login attempts. Try again later.", type: "rate_limit_error", code: "rate_limit_exceeded" } }, 429);
    }
  } catch (err) {
    logger.error({ err, ip }, "Account login rate limit Redis error");
    return c.json({ error: { message: "Service temporarily unavailable", type: "rate_limit_error", code: "service_unavailable" } }, 503);
  }

  await next();
}, async (c) => {
  const csrfToken = c.req.header("x-csrf-token");
  const cookieHeader = c.req.header("Cookie") || "";
  const csrfCookieMatch = cookieHeader.match(/csrf_token=([^;]+)/);
  const csrfCookie = csrfCookieMatch ? csrfCookieMatch[1] : null;
  
  if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
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

authRoutes.post("/auth/api-key/cookie", sessionAuth, async (c) => {
  const parsed = z.object({ apiKey: z.string().min(1) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { apiKey } = parsed.data;

  const cookieHeader = createApiKeyCookieHeader(apiKey);
  c.header("Set-Cookie", cookieHeader);

  return c.json({ success: true });
});

authRoutes.delete("/auth/api-key/cookie", sessionAuth, async (_c) => {
  const cookieHeader = createLogoutCookieHeader();
  _c.header("Set-Cookie", cookieHeader);
  return _c.json({ success: true });
});
