import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import nacl from "tweetnacl";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { config } from "../config.js";

const NONCE_TTL_MS = 10 * 60 * 1000;

function assertValidSolanaAddress(address: string): string {
  try {
    return new PublicKey(address).toBase58();
  } catch {
    throw new Error("Invalid Solana address");
  }
}

// ponytail: network derived from RPC URL — default mainnet, devnet when
// SOLANA_RPC_URL points to a devnet endpoint. Cheap string match avoids
// a new config var. If a multi-network future lands, swap for SOLANA_NETWORK.
function resolveSolanaNetwork(): string {
  const url = config.SOLANA_RPC_URL ?? "";
  return url.includes("devnet") ? "devnet" : "mainnet";
}

// SIWS (Sign-In With Solana) — header MUST reference the URI host per spec §1,
// not a brand name. The previous "OMA wants you to sign in" header tripped
// domain-mismatch checks against `URI: https://oma.ai`.
export function buildSolanaSignInMessage(address: string, nonce: string, issuedAt: Date = new Date()): string {
  const network = resolveSolanaNetwork();
  const expiry = new Date(issuedAt.getTime() + NONCE_TTL_MS);
  return [
    "oma.ai wants you to sign in with your Solana account:",
    address,
    "",
    "URI: https://oma.ai",
    "Version: 1",
    `Chain ID: solana:${network}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expiration Time: ${expiry.toISOString()}`,
    `Nonce: ${nonce}`,
  ].join("\n");
}

function decodeBase64Signature(signature: string): Uint8Array | null {
  try {
    return new Uint8Array(Buffer.from(signature, "base64"));
  } catch {
    return null;
  }
}

function decodeBase58Signature(signature: string): Uint8Array | null {
  try {
    return bs58.decode(signature);
  } catch {
    return null;
  }
}

function verifyDetachedSignature(message: Uint8Array, signature: string, publicKey: Uint8Array): boolean {
  const candidates = [decodeBase64Signature(signature), decodeBase58Signature(signature)].filter(
    (candidate): candidate is Uint8Array => Boolean(candidate),
  );

  return candidates.some((candidate) => nacl.sign.detached.verify(message, candidate, publicKey));
}

export async function getOrCreateSolanaUser(address: string) {
  const normalizedAddress = assertValidSolanaAddress(address);
  const existing = await db
    .select()
    .from(users)
    .where(or(eq(users.solanaAddress, normalizedAddress), eq(users.address, normalizedAddress)))
    .limit(1);

  if (existing.length > 0) {
    const [user] = existing;
    if (user.solanaAddress !== normalizedAddress || user.address !== normalizedAddress) {
      const [updated] = await db
        .update(users)
        .set({ address: normalizedAddress, solanaAddress: normalizedAddress, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      return updated;
    }
    return user;
  }

  const nonce = nanoid(32);
  const [created] = await db
    .insert(users)
    .values({
      address: normalizedAddress,
      solanaAddress: normalizedAddress,
      nonce,
    })
    .returning();

  return created;
}

export async function createSolanaChallenge(address: string) {
  const normalizedAddress = assertValidSolanaAddress(address);
  const user = await getOrCreateSolanaUser(normalizedAddress);

  let nonce = user.nonce;
  const age = Date.now() - user.updatedAt.getTime();
  if (age >= NONCE_TTL_MS) {
    nonce = nanoid(32);
    await db
      .update(users)
      .set({ nonce, updatedAt: new Date(), solanaAddress: normalizedAddress })
      .where(eq(users.id, user.id));
  }

  return {
    nonce,
    message: buildSolanaSignInMessage(normalizedAddress, nonce, user.updatedAt),
  };
}

export async function verifySolanaChallenge(address: string, message: string, signature: string) {
  const normalizedAddress = assertValidSolanaAddress(address);
  const rows = await db
    .select({ id: users.id, nonce: users.nonce, updatedAt: users.updatedAt, solanaAddress: users.solanaAddress })
    .from(users)
    .where(or(eq(users.solanaAddress, normalizedAddress), eq(users.address, normalizedAddress)))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const [user] = rows;
  const age = Date.now() - user.updatedAt.getTime();
  if (age > NONCE_TTL_MS) {
    return null;
  }

  // Reuse the same issuedAt that was used to build the original challenge so
  // the message is byte-for-byte identical to the one the user signed.
  const expectedMessage = buildSolanaSignInMessage(normalizedAddress, user.nonce, user.updatedAt);
  if (message !== expectedMessage) {
    return null;
  }

  const messageBytes = new TextEncoder().encode(message);
  const publicKeyBytes = new PublicKey(normalizedAddress).toBytes();
  const verified = verifyDetachedSignature(messageBytes, signature, publicKeyBytes);

  if (!verified) {
    return null;
  }

  await db
    .update(users)
    .set({ nonce: nanoid(32), updatedAt: new Date(), solanaAddress: normalizedAddress })
    .where(eq(users.id, user.id));

  return {
    address: normalizedAddress,
  };
}
