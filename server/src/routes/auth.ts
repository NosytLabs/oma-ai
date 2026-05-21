import { Hono } from "hono";
import { z } from "zod";
import { getOrCreateUser, verifySiweMessage, getNonce, generateSessionToken } from "../auth/siwe.js";
import { createApiKey, listApiKeys, revokeApiKey } from "../auth/api-keys.js";
import { sessionAuth } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import type { OmaEnv } from "../types.js";

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

function validationError(err: z.ZodError) {
  return { error: { message: `Validation error: ${err.errors.map((e) => e.message).join(", ")}`, type: "invalid_request_error" as const } };
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
  const token = await generateSessionToken(user.id);
  return c.json({ token, address: user.address });
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

authRoutes.post("/auth/logout", sessionAuth, async (c) => c.json({ success: true }));

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
  if (!result) return c.json({ error: { message: "API key not found", type: "not_found_error" } }, 404);
  return c.json({ success: true });
});
