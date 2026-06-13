import { SiweMessage } from "siwe";
import { nanoid } from "nanoid";
import { SignJWT, jwtVerify } from "jose";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { config } from "../config.js";
import { eq } from "drizzle-orm";
import { TextEncoder } from "util";
import type { AuthMethod } from "../types.js";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { NONCE_TTL_MS, NONCE_REDIS_TTL_SECONDS } from "../constants.js";

if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
  throw new Error("FATAL: JWT_SECRET must be configured with at least 32 characters. Current value is missing or too short.");
}
const JWT_SECRET = new TextEncoder().encode(config.JWT_SECRET);
const ISSUER = "oma-ai";
const AUDIENCE = "oma-ai-api";
const AUTH_METHODS = new Set<AuthMethod>(["siwe", "solana", "account-number", "sso"]);

export type SessionIdentity = {
  userId: string;
  authMethod: AuthMethod;
};

export async function getOrCreateUser(address: string) {
  const normalized = address.toLowerCase();
  const existing = await db.select().from(users).where(eq(users.address, normalized)).limit(1);
  if (existing.length > 0) {
    return existing[0];
  }
  const nonce = nanoid(32);
  const [created] = await db.insert(users).values({
    address: normalized,
    nonce,
  }).returning();
  return created;
}

export async function verifySiweMessage(message: string, signature: string) {
  const siweMessage = new SiweMessage(message);
  const normalized = siweMessage.address.toLowerCase();
  const rows = await db.select({ nonce: users.nonce, updatedAt: users.updatedAt }).from(users).where(eq(users.address, normalized)).limit(1);
  if (rows.length === 0) {
    return null;
  }
  const { nonce: userNonce, updatedAt } = rows[0];
  const age = Date.now() - updatedAt.getTime();
  if (age > NONCE_TTL_MS) {
    return null;
  }
  const result = await siweMessage.verify({ signature, nonce: userNonce });
  if (!result.success) {
    return null;
  }
  await db.update(users).set({ nonce: nanoid(32), updatedAt: new Date() }).where(eq(users.address, normalized));
  return result.data;
}

export async function getNonce(address: string) {
  const normalized = address.toLowerCase();
  const redis = await getRedisClient();
  const redisReady = isRedisReady();

  if (redis && redisReady) {
    const redisKey = `nonce:${normalized}`;
    const cachedNonce = await redis.get(redisKey);
    if (cachedNonce) {
      return cachedNonce;
    }
  }

  const existing = await db.select({
    nonce: users.nonce,
    updatedAt: users.updatedAt,
  }).from(users).where(eq(users.address, normalized)).limit(1);
  if (existing.length > 0) {
    const age = Date.now() - existing[0].updatedAt.getTime();
    if (age < NONCE_TTL_MS) {
      if (redis && redisReady) {
        const redisKey = `nonce:${normalized}`;
        await redis.setex(redisKey, NONCE_REDIS_TTL_SECONDS, existing[0].nonce);
      }
      return existing[0].nonce;
    }
  }
  const nonce = nanoid(32);
  await db.insert(users)
    .values({ address: normalized, nonce, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: users.address,
      set: { nonce, updatedAt: new Date() },
    });

  if (redis && redisReady) {
    const redisKey = `nonce:${normalized}`;
    await redis.setex(redisKey, NONCE_REDIS_TTL_SECONDS, nonce);
  }

  return nonce;
}

export async function generateSessionToken(userId: string, authMethod: AuthMethod = "siwe"): Promise<string> {
  return new SignJWT({ authMethod })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("24h")
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionIdentity | null> {
  try {
    // C10: pin the algorithm to HS256 to prevent "alg=none" / RS-vs-HS
    // confusion attacks. Allow 5s clock skew between issuer and
    // verifier to absorb minor clock drift across nodes.
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
      clockTolerance: 5,
    });
    if (!payload.sub) {
      return null;
    }

    const authMethod = typeof payload.authMethod === "string" && AUTH_METHODS.has(payload.authMethod as AuthMethod)
      ? payload.authMethod as AuthMethod
      : "siwe";

    return {
      userId: payload.sub,
      authMethod,
    };
  } catch {
    return null;
  }
}
