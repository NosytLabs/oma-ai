import { SiweMessage } from "siwe";
import { nanoid } from "nanoid";
import { SignJWT, jwtVerify } from "jose";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { config } from "../config.js";
import { eq } from "drizzle-orm";
import { TextEncoder } from "util";

if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
  throw new Error("FATAL: JWT_SECRET must be configured with at least 32 characters. Current value is missing or too short.");
}
const JWT_SECRET = new TextEncoder().encode(config.JWT_SECRET);
const ISSUER = "oma-ai";
const AUDIENCE = "oma-ai-api";

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
  const rows = await db.select({ nonce: users.nonce }).from(users).where(eq(users.address, normalized)).limit(1);
  if (rows.length === 0) {
    return null;
  }
  const userNonce = rows[0].nonce;
  const result = await siweMessage.verify({ signature, nonce: userNonce });
  if (!result.success) {
    return null;
  }
  await db.update(users).set({ nonce: nanoid(32) }).where(eq(users.address, normalized));
  return result.data;
}

export async function getNonce(address: string) {
  const normalized = address.toLowerCase();
  const nonce = nanoid(32);
  await db.insert(users)
    .values({ address: normalized, nonce })
    .onConflictDoUpdate({
      target: users.address,
      set: { nonce },
    });
  return nonce;
}

export async function generateSessionToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { issuer: ISSUER, audience: AUDIENCE });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
