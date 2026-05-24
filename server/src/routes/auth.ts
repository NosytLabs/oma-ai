import { Hono } from "hono";
import { z } from "zod";
import { getOrCreateUser, verifySiweMessage, getNonce, generateSessionToken } from "../auth/siwe.js";
import { createApiKey, listApiKeys, revokeApiKey } from "../auth/api-keys.js";
import { sessionAuth } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { db } from "../db/client.js";
import { users, apiKeys, subscriptions, auditLogs } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { validationError } from "../lib/validation.js";
import type { OmaEnv } from "../types.js";
import { createHash, randomBytes } from "crypto";
import { authenticator } from "@otplib/preset-default";

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

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
});

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
  
  let accountNumber = user.accountNumber;
  if (!accountNumber) {
    accountNumber = generateAccountNumber();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.accountNumberHash, hashAccountNumber(accountNumber))).limit(1);
      if (existing.length === 0) break;
      accountNumber = generateAccountNumber();
      attempts++;
    }
    const accountNumberHash = hashAccountNumber(accountNumber);
    await db.update(users).set({ accountNumber, accountNumberHash }).where(eq(users.id, user.id));
  }
  
  const token = await generateSessionToken(user.id);
  return c.json({ token, address: user.address, accountNumber });
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
  const [user] = await db.select({
    id: users.id,
    address: users.address,
    solanaAddress: users.solanaAddress,
    accountNumber: users.accountNumber,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, userId));
  if (!user) return c.json({ error: { message: "User not found", type: "not_found" } }, 404);
  return c.json(user);
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

  await db.update(users).set({ twoFactorSecret: secret }).where(eq(users.id, userId));

  return c.json({ secret, otpauth });
});

authRoutes.post("/auth/2fa/verify", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = z.object({ code: z.string().min(6).max(6) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { code } = parsed.data;

  const [user] = await db.select({ twoFactorSecret: users.twoFactorSecret }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.twoFactorSecret) return c.json({ error: { message: "2FA not set up", type: "invalid_request_error" } }, 400);

  const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
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

  const isCodeValid = authenticator.verify({ token: code, secret: user.twoFactorSecret! });
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
  // Create account number for existing user
  const userId = c.get("userId");
  if (!userId) return c.json({ error: { message: "Not authenticated", type: "authentication_error" } }, 401);
  
  const [user] = await db.select({ accountNumber: users.accountNumber }).from(users).where(eq(users.id, userId));
  if (user?.accountNumber) {
    return c.json({ error: { message: "Account number already exists", type: "invalid_request_error" } }, 400);
  }
  
  let accountNumber = generateAccountNumber();
  let attempts = 0;
  while (attempts < 100) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.accountNumberHash, hashAccountNumber(accountNumber))).limit(1);
    if (existing.length === 0) break;
    accountNumber = generateAccountNumber();
    attempts++;
  }
  
  const accountNumberHash = hashAccountNumber(accountNumber);
  await db.update(users).set({ accountNumber, accountNumberHash }).where(eq(users.id, userId));
  return c.json({ accountNumber });
});

authRoutes.post("/auth/account/login", rateLimit({ windowMs: 60_000, maxRequests: 10 }), async (c) => {
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
    newAccountNumber = generateAccountNumber();
    let attempts = 0;
    while (attempts < 100) {
      const existing = await db.select({ id: users.id }).from(users).where(eq(users.accountNumberHash, hashAccountNumber(newAccountNumber))).limit(1);
      if (existing.length === 0) break;
      newAccountNumber = generateAccountNumber();
      attempts++;
    }
    const newHash = hashAccountNumber(newAccountNumber);
    await db.update(users).set({ accountNumber: newAccountNumber, accountNumberHash: newHash }).where(eq(users.id, user.id));
  }
  
  const token = await generateSessionToken(user.id);
  return c.json({ token, address: user.address, hasApiKey: true });
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
