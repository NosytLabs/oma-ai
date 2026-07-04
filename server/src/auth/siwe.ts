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
import { logger } from "../lib/logger.js";

/**
 * Allowed SIWE `domain` values. EIP-4361 §4 requires the verifier to bind
 * the message to a known domain — without this, an attacker can lure a
 * victim to sign a SIWE message on `evil.com` and replay it against us.
 *
 * `PRIMARY_DOMAIN` is the canonical production domain; `ALLOWED_SIWE_DOMAINS`
 * (comma-separated env var) extends the list for staging / previews.
 */
function getAllowedSiweDomains(): string[] {
  const out = new Set<string>([config.PRIMARY_DOMAIN]);
  const extra = process.env.ALLOWED_SIWE_DOMAINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  for (const d of extra) out.add(d);
  return [...out];
}

if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
  throw new Error("FATAL: JWT_SECRET must be configured with at least 32 characters. Current value is missing or too short.");
}
const JWT_SECRET = new TextEncoder().encode(config.JWT_SECRET);
const ISSUER = "oma-ai";
const AUDIENCE = "oma-ai-api";
const AUTH_METHODS = new Set<AuthMethod>(["siwe", "account-number", "sso", "neon-auth"]);

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

  // Post-0030: users may have address=null and evmAddress set. Check both columns.
  let row: { nonce: string; updatedAt: Date } | null = null;
  let lookupField: "address" | "evmAddress" = "address";

  const legacyRow = await db
    .select({ nonce: users.nonce, updatedAt: users.updatedAt })
    .from(users)
    .where(eq(users.address, normalized))
    .limit(1);

  if (legacyRow.length > 0) {
    row = legacyRow[0];
  } else {
    const evmRow = await db
      .select({ nonce: users.nonce, updatedAt: users.updatedAt })
      .from(users)
      .where(eq(users.evmAddress, normalized))
      .limit(1);
    if (evmRow.length > 0) {
      row = evmRow[0];
      lookupField = "evmAddress";
    }
  }

  if (!row) return null;

  const { nonce: userNonce, updatedAt } = row;
  const age = Date.now() - updatedAt.getTime();
  if (age > NONCE_TTL_MS) return null;
  // H-SIWE-1: bind verification to one of the allowlisted domains. EIP-4361
  // §4 requires the verifier to enforce `domain` so an evil.com message
  // can't be replayed against oma.ai. siwe@3's `verify()` takes a single
  // string, so we iterate over the allowlist until one matches.
  const allowed = getAllowedSiweDomains();
  let result: { success: true; data: SiweMessage } | { success: false; error?: Error } | null = null;
  for (const domain of allowed) {
    const r = await siweMessage.verify({ signature, nonce: userNonce, domain });
    if (r.success) {
      result = r as { success: true; data: SiweMessage };
      break;
    }
  }
  if (!result || !result.success) {
    return null;
  }
  // Belt-and-braces explicit re-check: the siwe library returns success:false
  // on a domain mismatch, but log the attempt for visibility.
  if (!allowed.includes(siweMessage.domain)) {
    logger.warn({ claimed: siweMessage.domain }, "[siwe] rejected — domain not in allowlist");
    return null;
  }
  // Rotate the nonce on the correct lookup field so the same message can't
  // be replayed. Post-0030 users are keyed by evmAddress.
  if (lookupField === "evmAddress") {
    await db
      .update(users)
      .set({ nonce: nanoid(32), updatedAt: new Date() })
      .where(eq(users.evmAddress, normalized));
  } else {
    await db
      .update(users)
      .set({ nonce: nanoid(32), updatedAt: new Date() })
      .where(eq(users.address, normalized));
  }
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

  // Check both address and evmAddress columns (post-0030).
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
  } else {
    // Post-0030: check evmAddress column
    const evmExisting = await db.select({
      nonce: users.nonce,
      updatedAt: users.updatedAt,
    }).from(users).where(eq(users.evmAddress, normalized)).limit(1);
    if (evmExisting.length > 0) {
      const age = Date.now() - evmExisting[0].updatedAt.getTime();
      if (age < NONCE_TTL_MS) {
        if (redis && redisReady) {
          const redisKey = `nonce:${normalized}`;
          await redis.setex(redisKey, NONCE_REDIS_TTL_SECONDS, evmExisting[0].nonce);
        }
        return evmExisting[0].nonce;
      }
    }
  }

  // If no existing user found with this address (legacy or evmAddress), create one.
  // For new users we always write to the legacy `address` column for backwards compat.
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
