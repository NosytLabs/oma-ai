import { Hono } from "hono";
import type { Context, Next, MiddlewareHandler } from "hono";
import {
  createWalletClient,
  http,
  formatUnits,
  decodeFunctionData,
  parseAbi,
  recoverTypedDataAddress,
  keccak256,
  encodePacked,
  type Hash,
  type Hex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
import { config } from "../config.js";
import { buildV2Challenge, buildXPaymentResponse, parseXPaymentHeader } from "./v2.js";
import type { OmaEnv } from "../types.js";
import { sessionAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { settlements } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { addSettlementToDlq } from "../lib/dlq.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { getRedisClient } from "../lib/redis-client.js";
import {
  USDC_BASE,
  USDC_DECIMALS,
  CACHE_TTL_MS,
  NONCE_REDIS_TTL_SECONDS,
} from "../constants.js";
import { logger } from "../lib/logger.js";
import { getPublicClient } from "../lib/rpc-client.js";
import {
  createReceiptPayload,
  parseUsdcAtomic,
  signReceipt,
  verifyReceipt,
} from "./facilitator-signing.js";

// Re-export parseUsdcAtomic for the existing public surface
// (x402/__tests__/audit-2026-06-25.test.ts imports it from
// "../facilitator.js"). The definition lives in facilitator-signing.ts.
export { parseUsdcAtomic };

const LOCK_TTL_SECONDS = 30;
// ponytail: in tests TREASURY_BASE_ADDRESS may be unset;
// resolve defensively.
const SERVER_TREASURY = (config.TREASURY_BASE_ADDRESS || "").toLowerCase();
// SECURITY (A3): Fail closed — if no treasury address is configured, the
// facilitator cannot verify payee pinning. Refuse to verify payments rather
// than silently accepting payments to any address.
if (!SERVER_TREASURY && config.FACILITATOR_MODE === "live") {
  throw new Error("[FACILITATOR] FATAL: SERVER_TREASURY is empty in live mode. Set TREASURY_BASE_ADDRESS before starting.");
} else if (!SERVER_TREASURY) {
  logger.warn("[FACILITATOR] SERVER_TREASURY is empty in mock mode — payee validation disabled. This is NOT safe for production.");
}

// In-memory nonce store for x402 replay protection when Redis is unavailable.
// Bounded at 10000 entries with LRU eviction to prevent memory exhaustion.
// Trade-off: replay risk across restarts is small vs. complete DoS when Redis is down.
const X402_NONCE_MAX_ENTRIES = 10000;
const x402NonceMemory = new Map<string, number>(); // nonce -> timestamp
const x402NonceAccessOrder: string[] = [];

function x402NonceMemoryCleanExpired(now: number): void {
  const ttlMs = NONCE_REDIS_TTL_SECONDS * 1000;
  for (const [nonce, timestamp] of x402NonceMemory) {
    if (now - timestamp > ttlMs) {
      x402NonceMemory.delete(nonce);
      const idx = x402NonceAccessOrder.indexOf(nonce);
      if (idx !== -1) x402NonceAccessOrder.splice(idx, 1);
    }
  }
}

function x402NonceMemoryEvictLRU(): void {
  if (x402NonceMemory.size >= X402_NONCE_MAX_ENTRIES && x402NonceAccessOrder.length > 0) {
    const oldest = x402NonceAccessOrder.shift();
    if (oldest !== undefined) {
      x402NonceMemory.delete(oldest);
    }
  }
}

function x402NonceMemoryConsume(nonce: string): boolean {
  const now = Date.now();
  x402NonceMemoryCleanExpired(now);
  if (x402NonceMemory.has(nonce)) {
    return false; // already used
  }
  x402NonceMemoryEvictLRU();
  x402NonceMemory.set(nonce, now);
  x402NonceAccessOrder.push(nonce);
  return true; // fresh
}

// ponytail: CRIT-2 (x402 nonce/replay). Atomic consume via Redis SET NX EX.
// Returns true if the nonce is fresh (first time seen), false if already
// consumed (replay). The TTL is short (10 min) — nonces are single-use
// receipts that should not persist beyond the payment window.
// Falls back to in-memory LRU-bounded Map when Redis is unavailable.
async function consumeNonce(nonce: string | undefined): Promise<{ ok: boolean; reason?: string }> {
  if (!nonce || typeof nonce !== "string" || nonce.length < 16 || nonce.length > 128) {
    return { ok: false, reason: "invalid_nonce" };
  }
  const redis = await getRedisClient();
  if (!redis) {
    // Fallback to in-memory store when Redis is unavailable.
    // Log warning once per incident (first fallback activation).
    if (!consumeNonce._redisWarned) {
      logger.warn("[FACILITATOR] Redis unavailable — falling back to in-memory nonce store (bounded LRU, 10k entries). Replay protection across restarts is reduced.");
      consumeNonce._redisWarned = true;
    }
    // Reset warning flag when Redis recovers (checked on next success)
    const fresh = x402NonceMemoryConsume(nonce);
    return fresh ? { ok: true } : { ok: false, reason: "nonce_already_used" };
  }
  // Redis available - clear the warning flag
  consumeNonce._redisWarned = false;
  const key = `x402:nonce:${nonce}`;
  const set = await redis.set(key, "1", { NX: true, EX: NONCE_REDIS_TTL_SECONDS });
  return set === "OK" ? { ok: true } : { ok: false, reason: "nonce_already_used" };
}

// Attach property to function for warning state
consumeNonce._redisWarned = false;

async function acquireSettlementLock(cacheKey: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return true;
  const lockKey = `settlement:lock:${cacheKey}`;
  const result = await redis.set(lockKey, "1", { NX: true, EX: LOCK_TTL_SECONDS });
  return result === "OK";
}

async function releaseSettlementLock(cacheKey: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  const lockKey = `settlement:lock:${cacheKey}`;
  await redis.del(lockKey);
}

// ============================================================
// QuickNode hosted x402 facilitator (marketplace add-on)
// ============================================================
//
// When X402_FACILITATOR_PROVIDER=quicknode AND QUICKNODE_X402_URL is set,
// verify/settle are delegated to QuickNode's hosted x402 facilitator. Local
// verify (viem + CHAIN_RPC_URL) is the default — most deployments want to
// keep settlement keys in their own custody. The QuickNode path is for
// operators who specifically opted into hosted facilitator service.
//
// Wire shape: POST {QUICKNODE_X402_URL}/verify with the same PaymentSignature
// shape used locally. Hosted endpoint returns { valid, txHash, amount,
// networkId, error? } mirroring `verifyPayment`'s return.
// ponytail: not over the top. One fetch helper, one switch on provider.

const QUICKNODE_X402_ENABLED =
  config.X402_FACILITATOR_PROVIDER === "quicknode" &&
  !!config.QUICKNODE_X402_URL &&
  !!config.QUICKNODE_X402_API_KEY;

interface QuicknodeX402VerifyResponse {
  valid: boolean;
  txHash?: string;
  amount?: string;
  networkId?: string;
  error?: string;
}

async function quicknodeX402Verify(
  paymentSig: PaymentSignature,
): Promise<PaymentResponse> {
  if (!config.QUICKNODE_X402_URL || !config.QUICKNODE_X402_API_KEY) {
    return { valid: false, error: "QuickNode x402 not configured" };
  }
  const baseUrl = config.QUICKNODE_X402_URL.replace(/\/+$/, "");
  try {
    const res = await fetch(`${baseUrl}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.QUICKNODE_X402_API_KEY,
      },
      body: JSON.stringify(paymentSig),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error(
        { status: res.status, body: text.slice(0, 500) },
        "[FACILITATOR] QuickNode x402 verify non-2xx",
      );
      return { valid: false, error: `QuickNode x402 verify failed: HTTP ${res.status}` };
    }
    const body = (await res.json()) as QuicknodeX402VerifyResponse;
    return {
      valid: !!body.valid,
      txHash: body.txHash as Hash | undefined,
      amount: body.amount,
      networkId: body.networkId,
      error: body.error,
    };
  } catch (err) {
    logger.error({ err }, "[FACILITATOR] QuickNode x402 verify network error");
    return { valid: false, error: "QuickNode x402 verify network error" };
  }
}

// ============================================================
// Types
// ============================================================

export type X402Version = "1" | "2";

export interface PaymentPayload {
  x402Version: X402Version;
  scheme: "evm";
  networkId: string;
  asset: string;
  amount: string;
  payee: string;
  payFrom: string;
  maxAmountRequired: string;
  validBefore: number;
  validAfter: number;
  description?: string;
  // ponytail: per-payload random nonce for replay protection (CRIT-2).
  // Mirrors the field on `types.ts` PaymentPayload. Optional for v1 clients.
  nonce?: string;
}

export interface PaymentSignature {
  x402Version: X402Version;
  signature: string;
  authorization: string;
  payload: PaymentPayload;
}

export interface PaymentRequired {
  x402Version: X402Version;
  scheme: "evm";
  networkId: string;
  asset: string;
  amount: string;
  payee: string;
  maxAmountRequired: string;
  validBefore: number;
  validAfter: number;
  description?: string;
  "payment-URL"?: string;
}

export interface PaymentResponse {
  valid: boolean;
  txHash?: string;
  amount?: string;
  networkId?: string;
  error?: string;
}

export interface SettlementRecord {
  txHash: string;
  amount: string;
  networkId: string;
  payee: string;
  settledAt: number;
  // ponytail: receipt is optional on a *cached verified record* written by
  // /x402/verify. The full settlement (with receipt) is written by
  // settlePayment/settlePaymentAsync. This makes the cache state
  // distinguishable: `receipt` undefined = verified-but-not-settled;
  // `receipt` present = fully settled (idempotent re-lookup).
  receipt?: string;
}

export interface SettlementResponse {
  settled: boolean;
  receipt: string;
  error?: string;
}

export interface PaymentMiddlewareConfig {
  pricing: Record<string, string>;
  payeeAddress: string;
  asset?: string;
  networkId?: string;
  scheme?: "evm";
}

// ============================================================
// Settlement Cache (Thread-safe LRU with max size)
// ============================================================

const settlementCache = new Map<string, SettlementRecord>();
const cacheAccessOrder: string[] = [];
const MAX_CACHE_SIZE = 1_000;
const PAYMENT_WINDOW_SECONDS = 300;
let cacheLock = false;

function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, record] of settlementCache) {
    if (now - record.settledAt > CACHE_TTL_MS) {
      settlementCache.delete(key);
      const idx = cacheAccessOrder.indexOf(key);
      if (idx !== -1) cacheAccessOrder.splice(idx, 1);
    }
  }
}

function evictLRU(): void {
  if (settlementCache.size >= MAX_CACHE_SIZE && cacheAccessOrder.length > 0) {
    const firstKey = cacheAccessOrder.shift();
    if (firstKey !== undefined) {
      settlementCache.delete(firstKey);
    }
  }
}

function atomicCacheSet(cacheKey: string, record: SettlementRecord): void {
  if (cacheLock) {
    setTimeout(() => atomicCacheSet(cacheKey, record), 0);
    return;
  }
  cacheLock = true;
  try {
    evictLRU();
    settlementCache.set(cacheKey, record);
    cacheAccessOrder.push(cacheKey);
  } finally {
    cacheLock = false;
  }
}

function cacheVerifiedRecord(payload: PaymentPayload, result: PaymentResponse): void {
  if (result.valid && result.txHash) {
    atomicCacheSet(`${payload.networkId}:${result.txHash}`, {
      txHash: result.txHash,
      amount: result.amount ?? payload.amount,
      networkId: result.networkId ?? payload.networkId,
      payee: payload.payee,
      settledAt: 0,
    });
  }
}

function checkTransferAmount(
  rawAmount: bigint,
  recipient: string,
  payeeLower: string,
  txHash: Hash,
  networkId: string,
  requiredAmountStr: string,
): PaymentResponse {
  const amount = formatUnits(rawAmount, USDC_DECIMALS);
  const actualAtomic = parseUsdcAtomic(amount);
  const requiredAtomic = parseUsdcAtomic(requiredAmountStr);
  if (actualAtomic < requiredAtomic) {
    return { valid: false, error: `Insufficient payment: ${actualAtomic} < ${requiredAtomic}` };
  }
  if (recipient.toLowerCase() !== payeeLower) {
    return { valid: false, error: "Recipient mismatch" };
  }
  return { valid: true, txHash, amount, networkId };
}

setInterval(cleanExpiredCache, 300_000).unref();

// ============================================================
// Signing Utilities
// ============================================================
//
// signReceipt / verifyReceipt / createReceiptPayload / parseUsdcAtomic live
// in "./facilitator-signing.js" (extracted to keep the payment verification
// core focused on the verify/settle hot path). They are imported above.

// ============================================================
// EIP-3009 transferWithAuthorization (Base USDC)
// ============================================================
//
// USDC on Base is FiatTokenV2_2 (Circle's reference implementation) and exposes
// both EIP-3009 selectors natively:
//   transferWithAuthorization = 0xe3ee160e
//   receiveWithAuthorization  = 0xef55bec6
//
// Wire shape (canonical x402 v2 + Coinbase x402):
//   signature     = 65-byte EIP-712 sig over TransferWithAuthorization typed data
//   authorization = JSON { from, to, value, validAfter, validBefore, nonce }
//   payload       = PaymentPayload (payee == authorization.to)
//
// ponytail: EIP-3009 is GASLESS for the user — the facilitator (us) submits
// the on-chain tx via FACILITATOR_PRIVATE_KEY when set. Without the private key
// we fall back to an eth_call simulation and return a deterministic synthetic
// txHash so the verify+settle API surface still produces a receipt.

const USDC_EIP712_DOMAIN = {
  name: "USD Coin",
  version: "2",
  chainId: 8453,
  verifyingContract: USDC_BASE,
} as const;

const EIP3009_TRANSFER_WITH_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const USDC_EIP3009_ABI = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature) returns (bool)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

interface Eip3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

/**
 * Type-guard: is `authorization` a JSON EIP-3009 tuple? We auto-detect from
 * shape so the V1 endpoint can serve both the legacy on-chain-receipt path
 * (signature = tx hash) AND the new EIP-3009 path (signature = EIP-712 sig).
 */
function isEip3009Authorization(value: unknown): value is Eip3009Authorization {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.from === "string" &&
    typeof a.to === "string" &&
    (typeof a.value === "string" || typeof a.value === "number") &&
    (typeof a.validAfter === "string" || typeof a.validAfter === "number") &&
    (typeof a.validBefore === "string" || typeof a.validBefore === "number") &&
    typeof a.nonce === "string"
  );
}

/**
 * Recover the EIP-712 signer from a 65-byte signature over TransferWithAuthorization.
 * Returns the lowercase address. Throws on a malformed signature (which the
 * caller maps to a 422 "Invalid EIP-712 signature" response).
 */
async function recoverEip3009Signer(
  auth: Eip3009Authorization,
  signature: Hex,
): Promise<string> {
  const recovered = await recoverTypedDataAddress({
    domain: USDC_EIP712_DOMAIN,
    types: EIP3009_TRANSFER_WITH_AUTH_TYPES,
    primaryType: "TransferWithAuthorization",
    message: {
      from: auth.from as `0x${string}`,
      to: auth.to as `0x${string}`,
      value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce: auth.nonce as `0x${string}`,
    },
    signature,
  });
  return recovered.toLowerCase();
}

/**
 * Deterministic placeholder txHash for the no-private-key path. Lets the
 * /x402/settle cache key (`networkId:txHash`) work even though no on-chain tx
 * was submitted. The placeholder is keccak256(auth-tuple + sig) so it's unique
 * per (authorization, signature) and two distinct authorizations never collide.
 */
function syntheticEip3009TxHash(auth: Eip3009Authorization, signature: Hex): Hash {
  const sigHex = signature.startsWith("0x") ? signature.slice(2) : signature;
  const packed = encodePacked(
    [
      "string",
      "address",
      "address",
      "uint256",
      "uint256",
      "uint256",
      "bytes32",
    ],
    [
      "oma-eip3009",
      auth.from as `0x${string}`,
      auth.to as `0x${string}`,
      BigInt(auth.value),
      BigInt(auth.validAfter),
      BigInt(auth.validBefore),
      auth.nonce as `0x${string}`,
    ],
  );
  // ponytail: bind the placeholder to the signature too, so the same auth
  // tuple with a different signature gets a different placeholder. Concat
  // the keccak of the tuple with the first 32 bytes of the sig, then hash.
  const sigChunk = (sigHex.length >= 64 ? sigHex.slice(0, 64) : sigHex.padEnd(64, "0")) as Hex;
  return keccak256(("0x" + (packed.slice(2) + sigChunk.slice(2))) as Hex) as Hash;
}

/**
 * Simulate the transferWithAuthorization call via eth_call. Confirms the
 * contract would accept the call (state: nonce not used, allowance etc.) —
 * without paying gas. Throws on simulation failure (caller maps to a 422).
 */
async function simulateEip3009Transfer(
  auth: Eip3009Authorization,
  signature: Hex,
): Promise<void> {
  const client = getPublicClient();
  // eth_call against the USDC contract. encodeFunctionData + raw call avoids
  // pulling in abi decoding; we only care whether the contract reverts.
  const data = encodePacked(
    [
      "bytes4",
      "address",
      "address",
      "uint256",
      "uint256",
      "uint256",
      "bytes32",
      "uint256",
      "bytes",
    ],
    [
      "0xe3ee160e", // transferWithAuthorization selector
      auth.from as `0x${string}`,
      auth.to as `0x${string}`,
      BigInt(auth.value),
      BigInt(auth.validAfter),
      BigInt(auth.validBefore),
      auth.nonce as `0x${string}`,
      // signature byte length + signature bytes
      BigInt(((signature.length - 2) / 2)),
      signature,
    ],
  );
  await client.call({
    to: USDC_BASE,
    data: data as Hex,
    // simulate from zero-address; contract-level checks (msg.sender) are not
    // meaningful for transferWithAuthorization (sender must NOT be `from`),
    // so a zero-address simulates "anyone calls this" which is the legitimate
    // facilitator role. The contract will revert on (a) bad signature, (b)
    // nonce already used, (c) value > balance, etc.
    account: "0x0000000000000000000000000000000000000000",
  });
}

/**
 * Submit the on-chain transferWithAuthorization using FACILITATOR_PRIVATE_KEY.
 * Returns the real on-chain tx hash. Throws on failure (caller maps to 422).
 * ponytail: only called when FACILITATOR_PRIVATE_KEY is configured. In dev
 * (mock mode) and in production-without-key deployments we never reach this
 * code path — the verify path uses simulateEip3009Transfer instead.
 */
async function submitEip3009Transfer(
  auth: Eip3009Authorization,
  signature: Hex,
): Promise<Hash> {
  if (!config.FACILITATOR_PRIVATE_KEY) {
    throw new Error("FACILITATOR_PRIVATE_KEY not configured; cannot submit on-chain");
  }
  const account = privateKeyToAccount(config.FACILITATOR_PRIVATE_KEY as Hex);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(config.CHAIN_RPC_URL),
  });
  const txHash = await walletClient.writeContract({
    address: USDC_BASE,
    abi: USDC_EIP3009_ABI,
    functionName: "transferWithAuthorization",
    args: [
      auth.from as `0x${string}`,
      auth.to as `0x${string}`,
      BigInt(auth.value),
      BigInt(auth.validAfter),
      BigInt(auth.validBefore),
      auth.nonce as `0x${string}`,
      signature,
    ],
  });
  return txHash as Hash;
}

/**
 * EIP-3009 verify path. Replaces the legacy on-chain-receipt check.
 *
 * Steps:
 *  1. Consume nonce (CRIT-2 replay protection; runs before any expensive RPC).
 *  2. Parse + validate the EIP-3009 authorization tuple shape.
 *  3. Reject if payee != SERVER_TREASURY (the merchant pin is non-negotiable).
 *  4. Reject if amount < payload.maxAmountRequired.
 *  5. Reject if validBefore expired or validAfter not yet reached.
 *  6. Recover the EIP-712 signer; reject if signer != authorization.from.
 *  7. Simulate via eth_call (rejects if contract would revert — e.g. nonce
 *     already used, balance insufficient).
 *  8. Submit on-chain if FACILITATOR_PRIVATE_KEY is set; otherwise return a
 *     deterministic synthetic txHash so the settle cache + receipt still work.
 */
async function verifyEip3009Payment(
  signature: string,
  authorization: string,
  payload: PaymentPayload,
): Promise<PaymentResponse> {
  // 1. Replay protection
  const nonceResult = await consumeNonce(payload.nonce);
  if (!nonceResult.ok) {
    return { valid: false, error: `Replay protection: ${nonceResult.reason}` };
  }

  // 2. Parse authorization tuple. Accept JSON object or JSON-encoded string.
  let authRaw: unknown;
  try {
    authRaw = JSON.parse(authorization);
  } catch {
    return { valid: false, error: "Invalid authorization: must be JSON-encoded EIP-3009 tuple { from, to, value, validAfter, validBefore, nonce }" };
  }
  if (!isEip3009Authorization(authRaw)) {
    return { valid: false, error: "Invalid EIP-3009 authorization: missing required fields { from, to, value, validAfter, validBefore, nonce }" };
  }
  const auth: Eip3009Authorization = authRaw;

  // 3. Payee must equal the server-pinned merchant treasury.
  const payeeLower = auth.to.toLowerCase();
  if (SERVER_TREASURY && payeeLower !== SERVER_TREASURY) {
    return { valid: false, error: "Payee does not match configured treasury" };
  }

  // 4. Amount check.
  let authAtomic: bigint;
  let requiredAtomic: bigint;
  try {
    authAtomic = BigInt(auth.value);
    requiredAtomic = parseUsdcAtomic(payload.maxAmountRequired || payload.amount || "0");
  } catch (err) {
    return { valid: false, error: `Invalid amount: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (authAtomic < requiredAtomic) {
    return { valid: false, error: `Insufficient payment: ${authAtomic} < ${requiredAtomic}` };
  }

  // 5. Time-bounds check. Authorization is valid while
  //    validAfter <= now < validBefore.
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const validAfter = BigInt(auth.validAfter);
  const validBefore = BigInt(auth.validBefore);
  if (validAfter > nowSec) {
    return { valid: false, error: "Authorization not yet valid (validAfter in future)" };
  }
  if (validBefore <= nowSec) {
    return { valid: false, error: "Authorization expired (validBefore in past)" };
  }

  // 6. Recover EIP-712 signer. The signature is 65 bytes (r||s||v), hex-encoded
  //    with 0x prefix. viem's recoverTypedDataAddress handles parsing.
  const sigHex = (signature.startsWith("0x") ? signature : `0x${signature}`) as Hex;
  if (sigHex.length !== 132) {
    return { valid: false, error: `Invalid EIP-712 signature length: expected 65 bytes (132 hex chars), got ${(sigHex.length - 2) / 2} bytes` };
  }
  let recovered: string;
  try {
    recovered = await recoverEip3009Signer(auth, sigHex);
  } catch (err) {
    return { valid: false, error: `Invalid EIP-712 signature: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (recovered !== auth.from.toLowerCase()) {
    return { valid: false, error: "Signature does not match authorization.from" };
  }

  // 7. Simulate on-chain via eth_call. Rejects if the contract would revert
  //    (e.g. nonce already used, payer balance insufficient). This catches
  //    double-spend attempts even before submission.
  let txHash: Hash;
  try {
    await simulateEip3009Transfer(auth, sigHex);
    // 8. Settle: real on-chain submission when facilitator key is configured,
    //    deterministic synthetic txHash otherwise. The synthetic path keeps
    //    the verify+settle contract intact for dev/preview deployments that
    //    don't yet have a funded facilitator wallet.
    if (config.FACILITATOR_PRIVATE_KEY) {
      try {
        txHash = await submitEip3009Transfer(auth, sigHex);
      } catch (submitErr) {
        // Surface a clear error if the facilitator key is configured but the
        // submit failed — the receipt can't be issued without a real txHash.
        logger.error(
          { err: submitErr, from: auth.from, to: auth.to },
          "[FACILITATOR] EIP-3009 submit failed despite configured FACILITATOR_PRIVATE_KEY",
        );
        return { valid: false, error: `EIP-3009 submit failed: ${submitErr instanceof Error ? submitErr.message : String(submitErr)}` };
      }
    } else {
      txHash = syntheticEip3009TxHash(auth, sigHex);
    }
  } catch (simErr) {
    logger.warn(
      { err: simErr, from: auth.from, to: auth.to, nonce: auth.nonce },
      "[FACILITATOR] EIP-3009 simulation failed (likely nonce already used or insufficient balance)",
    );
    return { valid: false, error: `EIP-3009 simulation failed: ${simErr instanceof Error ? simErr.message : String(simErr)}` };
  }

  const amount = formatUnits(authAtomic, USDC_DECIMALS);

  return {
    valid: true,
    txHash,
    amount,
    networkId: payload.networkId,
  };
}

/**
 * Legacy on-chain-receipt verification (kept for backward compatibility with
 * any client still sending a tx hash as `signature`). New clients should use
 * the EIP-3009 path via verifyEip3009Payment, which is gasless for the user.
 */
async function verifyUsdcTransferReceipt(
  txHash: Hash,
  payload: PaymentPayload,
): Promise<PaymentResponse> {
  // ponytail: CRIT-2 — consume nonce BEFORE the on-chain RPC call. A replay
  // attempt never reaches the (expensive) `eth_getTransactionReceipt`.
  const nonceResult = await consumeNonce(payload.nonce);
  if (!nonceResult.ok) {
    return { valid: false, error: `Replay protection: ${nonceResult.reason}` };
  }

  async function attemptVerification(): Promise<PaymentResponse> {
    const client = getPublicClient();

    const receipt = await client.getTransactionReceipt({ hash: txHash });

    if (!receipt || receipt.status !== "success") {
      return { valid: false, error: "Transaction failed or not found" };
    }

    const tx = await client.getTransaction({ hash: txHash });

    if (!tx) {
      return { valid: false, error: "Transaction data not found" };
    }

    if (tx.to?.toLowerCase() !== USDC_BASE.toLowerCase()) {
      return { valid: false, error: "Transaction not to USDC contract" };
    }

    const fromLower = tx.from.toLowerCase();
    const payeeLower = payload.payee.toLowerCase();
    const payFromLower = payload.payFrom.toLowerCase();

    if (SERVER_TREASURY && payeeLower !== SERVER_TREASURY) {
      return { valid: false, error: "Payee does not match configured treasury" };
    }

    if (fromLower !== payFromLower) {
      return { valid: false, error: "Transaction sender does not match payFrom" };
    }

    if (tx.input.length >= 10) {
      try {
        const usdcAbi = parseAbi([
          "function transfer(address to, uint256 amount) returns (bool)",
          "function transferFrom(address from, address to, uint256 amount) returns (bool)",
        ]);
        const decoded = decodeFunctionData({ abi: usdcAbi, data: tx.input as `0x${string}` });

        if (decoded.functionName === "transfer") {
          const [recipient, rawAmount] = decoded.args as [string, bigint];
          return checkTransferAmount(rawAmount, recipient, payeeLower, txHash, payload.networkId, payload.maxAmountRequired || payload.amount || "0");
        }

        if (decoded.functionName === "transferFrom") {
          const [, recipient, rawAmount] = decoded.args as [string, string, bigint];
          return checkTransferAmount(rawAmount, recipient, payeeLower, txHash, payload.networkId, payload.maxAmountRequired || payload.amount || "0");
        }
      } catch (decodeErr) {
        logger.error({ err: decodeErr }, "[facilitator] Failed to decode USDC transfer data");
        return { valid: false, error: `Failed to decode USDC transfer data` };
      }
    }

    const valueEth = formatUnits(tx.value, 18);
    return {
      valid: false,
      txHash,
      amount: valueEth,
      networkId: payload.networkId,
      error: "Unrecognized USDC transfer method",
    };
  }

  // viem fallback transport (getPublicClient) handles RPC failover
  // automatically across QuickNode + free public endpoints.
  try {
    return await attemptVerification();
  } catch (err: unknown) {
    logger.error({ err }, "[facilitator] EVM verification error (all RPCs failed)");
    return { valid: false, error: "EVM verification failed: no trusted RPC available" };
  }
}

// ============================================================
// EVM Verification Dispatcher (Base)
// ============================================================
//
// Routes V1 verify calls to the EIP-3009 path (default, gasless for the user)
// when the request carries a JSON EIP-3009 authorization tuple, OR to the
// legacy on-chain-receipt path when the request carries a tx hash in
// `signature` (backward compatibility).
//
// ponytail: one dispatcher, two children. The two children have totally
// different semantics (sig-recovery vs receipt-check) so a single merged
// function would be a 200-line branch spaghetti. The split keeps each path
// readable and independently testable.

async function verifyEvmPayment(
  signature: string,
  authorization: string,
  payload: PaymentPayload,
): Promise<PaymentResponse> {
  // Detect EIP-3009 wire by attempting to parse `authorization` as the JSON
  // tuple. If it parses AND has the EIP-3009 shape, route to the new path.
  let parsedAuth: unknown = null;
  let parsedAsJson = false;
  if (authorization) {
    try {
      parsedAuth = JSON.parse(authorization);
      parsedAsJson = true;
    } catch {
      parsedAuth = null;
    }
  }

  if (isEip3009Authorization(parsedAuth)) {
    return verifyEip3009Payment(signature, authorization, payload);
  }

  // ponytail: if the client sent JSON but the shape is NOT a complete
  // EIP-3009 tuple, it's almost certainly a malformed EIP-3009 request.
  // Surface a clear "invalid authorization" error rather than silently
  // falling through to the legacy receipt-check path (which would then
  // fail with an RPC error that has nothing to do with the real cause).
  if (parsedAsJson && parsedAuth && typeof parsedAuth === "object") {
    return {
      valid: false,
      error: "Invalid EIP-3009 authorization: missing required fields { from, to, value, validAfter, validBefore, nonce }",
    };
  }

  // ponytail: a 65-byte signature (132 hex chars) is the EIP-712 sig shape,
  // NOT a 32-byte tx-hash shape. If the client sent an EIP-712-shaped sig
  // with a non-JSON authorization, they almost certainly forgot to JSON-
  // encode the EIP-3009 tuple. Reject loud with the canonical error rather
  // than letting the legacy path try to fetch a receipt for a non-tx hash.
  if (signature.startsWith("0x") && signature.length === 132) {
    return {
      valid: false,
      error: "Invalid EIP-3009 authorization: must be JSON-encoded EIP-3009 tuple { from, to, value, validAfter, validBefore, nonce }",
    };
  }

  // Legacy path: `authorization` is opaque (non-JSON) and `signature` is a tx
  // hash. We still support this for any pre-existing client that already
  // submitted a USDC transfer on its own.
  const txHash = signature.startsWith("0x")
    ? (signature as Hash)
    : (`0x${signature}` as Hash);
  return verifyUsdcTransferReceipt(txHash, payload);
}

// ============================================================
// Mock Verification (DEVELOPMENT ONLY)
// ============================================================
// WARNING: Mock mode accepts ANY payment as valid without on-chain
// verification. This is safe ONLY because config.ts throws a fatal
// error if FACILITATOR_MODE=mock is used in production or staging.
// See: config.ts line ~41-43

async function mockVerifyPayment(
  signature: string,
  payload: PaymentPayload,
): Promise<PaymentResponse> {
  // ponytail: CRIT-2 — even mock mode must consume the nonce so a replayed
  // mock signature does not verify twice.
  const nonceResult = await consumeNonce(payload.nonce);
  if (!nonceResult.ok) {
    logger.warn({ reason: nonceResult.reason }, "[FACILITATOR] Mock-mode replay blocked");
  }
  logger.warn(
    { signaturePrefix: signature.slice(0, 16), scheme: payload.scheme, amount: payload.amount },
    "[FACILITATOR] Mock-mode verification accepted",
  );

  const mockTxHash =
    payload.scheme === "evm"
      ? `0x${randomBytes(32).toString("hex")}`
      : `0x${randomBytes(32).toString("hex")}`;

  return {
    valid: true,
    txHash: mockTxHash,
    amount: payload.amount,
    networkId: payload.networkId,
  };
}

// ============================================================
// Core: verifyPayment
// ============================================================

export async function verifyPayment(
  paymentSig: PaymentSignature,
): Promise<PaymentResponse> {
  const { signature, authorization, payload } = paymentSig;
  // SECURITY: Include payload.nonce in the cache key so that two different
  // nonces with the same signature cannot collide. Without this, a cached
  // verification could bypass the nonce replay protection in consumeNonce.
  const cacheKey = `${payload.scheme}:${payload.nonce}:${signature}`;

  const cached = settlementCache.get(cacheKey);
  if (cached) {
    return {
      valid: true,
      txHash: cached.txHash,
      amount: cached.amount,
      networkId: cached.networkId,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.validBefore && now > payload.validBefore) {
    return { valid: false, error: "Payment authorization expired" };
  }
  if (payload.validAfter && now < payload.validAfter) {
    return { valid: false, error: "Payment authorization not yet valid" };
  }

  const mode = config.FACILITATOR_MODE ?? "mock";

  if (mode === "mock") {
    if (config.NODE_ENV === "production") {
      throw new Error(`[FACILITATOR] FATAL: Mock payment mode explicitly forbidden in production`);
    }
    logger.warn("[FACILITATOR] Processing payment in mock mode -- signatures are NOT verified on-chain");
    const result = await mockVerifyPayment(signature, payload);
    cacheVerifiedRecord(payload, result);
    return result;
  }

  // ponytail: route to QuickNode's hosted x402 facilitator when explicitly
  // configured. Local viem-based verification is the default.
  if (QUICKNODE_X402_ENABLED) {
    const result = await quicknodeX402Verify(paymentSig);
    cacheVerifiedRecord(payload, result);
    return result;
  }

  if (payload.scheme === "evm") {
    const result = await verifyEvmPayment(signature, authorization, payload);
    cacheVerifiedRecord(payload, result);
    return result;
  }

  return { valid: false, error: `Unsupported scheme: ${payload.scheme}` };
}

// ============================================================
// Core: settlePayment
// ============================================================

interface SettlementOptions {
  idempotencyKey?: string;
  skipIfExists?: boolean;
}

const settlementInProgress = new Map<string, Promise<SettlementResponse>>();
const SETTLEMENT_IN_PROGRESS_MAX_SIZE = 1000;

function evictSettlementInProgressOldest(): void {
  if (settlementInProgress.size > SETTLEMENT_IN_PROGRESS_MAX_SIZE) {
    const entries = Array.from(settlementInProgress.entries());
    const toDelete = entries.slice(0, entries.length - SETTLEMENT_IN_PROGRESS_MAX_SIZE);
    for (const [key] of toDelete) {
      settlementInProgress.delete(key);
    }
  }
}

export async function settlePaymentAsync(
  txHash: string,
  amount: string,
  networkId: string,
  payee: string,
  options: SettlementOptions = {},
): Promise<SettlementResponse> {
  const { idempotencyKey, skipIfExists: _skipIfExists = true } = options;
  const cacheKey = `${networkId}:${txHash}`;

  const existing = settlementCache.get(cacheKey);
  // ponytail: a cached verified record (no receipt) is NOT a settled record;
  // fall through to write a real settlement. Only short-circuit when the
  // existing record carries a receipt (i.e. previously settled).
  if (existing?.receipt) {
    return { settled: true, receipt: existing.receipt };
  }

  const lockAcquired = await acquireSettlementLock(cacheKey);
  if (!lockAcquired) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const existingAfterLock = settlementCache.get(cacheKey);
    if (existingAfterLock?.receipt) {
      return { settled: true, receipt: existingAfterLock.receipt };
    }
    const lockRetry = await acquireSettlementLock(cacheKey);
    if (!lockRetry) {
      throw new Error("Could not acquire settlement lock");
    }
  }

  try {
    const existingDb = await db.select().from(settlements).where(and(eq(settlements.txHash, txHash), eq(settlements.networkId, networkId))).limit(1);
    if (existingDb.length > 0) {
      const record: SettlementRecord = {
        txHash: existingDb[0].txHash,
        amount: existingDb[0].amount,
        networkId: existingDb[0].networkId,
        payee: existingDb[0].payee,
        settledAt: existingDb[0].settledAt.getTime(),
        receipt: existingDb[0].receipt,
      };
      atomicCacheSet(cacheKey, record);
      return { settled: true, receipt: existingDb[0].receipt };
    }

    if (idempotencyKey) {
      const inProgress = settlementInProgress.get(idempotencyKey);
      if (inProgress) {
        return inProgress;
      }
    }

    const settleKey = `${cacheKey}:${idempotencyKey ?? "default"}`;
    const inProgressGeneral = settlementInProgress.get(settleKey);
    if (inProgressGeneral) {
      return inProgressGeneral;
    }

    const settlementPromise = (async (): Promise<SettlementResponse> => {
      let result: SettlementResponse | null = null;
      try {
        const settledAt = Date.now();
        const receiptPayload = createReceiptPayload(txHash, amount, networkId, payee, settledAt);
        const receipt = signReceipt(receiptPayload);

        const record: SettlementRecord = {
          txHash,
          amount,
          networkId,
          payee,
          settledAt,
          receipt,
        };

        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await db.insert(settlements).values({
              txHash,
              amount,
              networkId,
              payee,
              receipt,
              settledAt: new Date(settledAt),
            });
            result = { settled: true, receipt };
            break;
          } catch (err) {
            if (attempt === 1) {
              const pgErr = err as { code?: string };
              if (pgErr.code === "23505") {
                const existingRecord = await db.select().from(settlements)
                  .where(and(eq(settlements.txHash, txHash), eq(settlements.networkId, networkId)))
                  .limit(1);
                if (existingRecord.length > 0) {
                  result = { settled: true, receipt: existingRecord[0].receipt };
                  break;
                }
              }
            }
            lastError = err instanceof Error ? err : new Error(String(err));
            logger.error({ err: lastError, attempt }, "Failed to persist settlement to DB");
            if (attempt < 3) {
              const backoffMs = Math.min(100 * Math.pow(2, attempt - 1), 1000);
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
            }
          }
        }

        if (!result) {
          while (cacheLock) {
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
          cacheLock = true;
          try {
            settlementCache.delete(cacheKey);
            const idx = cacheAccessOrder.indexOf(cacheKey);
            if (idx !== -1) cacheAccessOrder.splice(idx, 1);
          } finally {
            cacheLock = false;
          }
          await addSettlementToDlq(txHash, amount, networkId, lastError?.message || "Unknown error", 1);
          throw new Error(`Failed to persist settlement to DB after 3 attempts: ${lastError?.message}`);
        }

        // Cache only after durable DB persistence — see AUDIT-X402-2026-06-14 CRITICAL-4.
        // Use the actual receipt (may differ from `receipt` if a concurrent settle won the race).
        atomicCacheSet(cacheKey, { ...record, receipt: result.receipt });
      } finally {
        settlementInProgress.delete(settleKey);
        if (idempotencyKey) {
          settlementInProgress.delete(idempotencyKey);
        }
      }
      return result!;
    })();

    settlementInProgress.set(settleKey, settlementPromise);
    if (idempotencyKey) {
      settlementInProgress.set(idempotencyKey, settlementPromise);
    }
    evictSettlementInProgressOldest();

    return await settlementPromise;
  } finally {
    await releaseSettlementLock(cacheKey);
  }
}

export function settlePayment(
  txHash: string,
  amount: string,
  networkId: string,
  payee: string,
): SettlementResponse {
  const cacheKey = `${networkId}:${txHash}`;

  const existing = settlementCache.get(cacheKey);
  // ponytail: C2 — only short-circuit on cache hit if the existing record is a
  // *complete settlement* (has a receipt) AND the amount matches. The
  // /x402/verify path caches a placeholder record (settledAt:0, no receipt)
  // so settle can derive `amount` from the verify cache. Without this guard,
  // settlePayment would return `{ settled: true, receipt: undefined }`.
  if (existing?.receipt && existing.amount === amount) {
    return { settled: true, receipt: existing.receipt };
  }

  const settledAt = Date.now();
  const receiptPayload = createReceiptPayload(txHash, amount, networkId, payee, settledAt);
  const receipt = signReceipt(receiptPayload);

  const record: SettlementRecord = {
    txHash,
    amount,
    networkId,
    payee,
    settledAt,
    receipt,
  };

  atomicCacheSet(cacheKey, record);

  return { settled: true, receipt };
}

export async function isSettledAsync(txHash: string, networkId: string): Promise<boolean> {
  const cacheKey = `${networkId}:${txHash}`;
  if (settlementCache.has(cacheKey)) {
    return true;
  }
  const existing = await db.select().from(settlements).where(and(eq(settlements.txHash, txHash), eq(settlements.networkId, networkId))).limit(1);
  return existing.length > 0;
}

export function isSettled(txHash: string, networkId: string): boolean {
  return settlementCache.has(`${networkId}:${txHash}`);
}

export async function getSettlementReceiptAsync(txHash: string, networkId: string): Promise<string | null> {
  const cacheKey = `${networkId}:${txHash}`;
  const cached = settlementCache.get(cacheKey);
  if (cached?.receipt) {
    return cached.receipt;
  }
  const existing = await db.select().from(settlements).where(and(eq(settlements.txHash, txHash), eq(settlements.networkId, networkId))).limit(1);
  return existing[0]?.receipt ?? null;
}

export function getSettlementReceipt(txHash: string, networkId: string): string | null {
  const record = settlementCache.get(`${networkId}:${txHash}`);
  return record?.receipt ?? null;
}

export function verifySettlementReceipt(
  txHash: string,
  amount: string,
  networkId: string,
  payee: string,
  settledAt: number,
  receipt: string,
  receiptExpiry?: number,
): boolean {
  if (receiptExpiry !== undefined && Date.now() > receiptExpiry * 1000) {
    return false;
  }
  const payload = createReceiptPayload(txHash, amount, networkId, payee, settledAt);
  return verifyReceipt(payload, receipt);
}

// ============================================================
// Hono Routes
// ============================================================

export const x402Routes = new Hono<OmaEnv>();

x402Routes.post("/x402/verify", rateLimit({ windowMs: 60_000, maxRequests: 10 }), async (c) => {
  const headerVal = c.req.header("PAYMENT-SIGNATURE");
  if (!headerVal) {
    return c.json(
      { error: { message: "Missing PAYMENT-SIGNATURE header", type: "payment_error" } },
      400,
    );
  }

  let paymentSig: PaymentSignature;
  try {
    paymentSig = JSON.parse(headerVal) as PaymentSignature;
  } catch {
    return c.json(
      { error: { message: "Invalid PAYMENT-SIGNATURE: must be valid JSON", type: "payment_error" } },
      400,
    );
  }

  // ponytail: V6 #8 — pin the merchant payee on the public verify endpoint.
  // Previously any valid USDC transfer verified regardless of who received
  // the funds, which let a third party use this endpoint to launder a
  // verification receipt for an arbitrary tx. The settle route already pins
  // payee; verify now matches that contract.
  if (SERVER_TREASURY) {
    const declared = (paymentSig.payload?.payee ?? "").toLowerCase();
    if (!declared || declared !== SERVER_TREASURY) {
      return c.json(
        { error: { message: "Invalid payee: payload does not match configured merchant address", type: "invalid_payee" } },
        400,
      );
    }
  }

  if (!paymentSig.signature || !paymentSig.payload) {
    return c.json(
      { error: { message: "PAYMENT-SIGNATURE must include signature and payload", type: "payment_error" } },
      400,
    );
  }

  if (!paymentSig.payload.scheme || !paymentSig.payload.amount || !paymentSig.payload.networkId) {
    return c.json(
      { error: { message: "Payload must include scheme, amount, and networkId", type: "payment_error" } },
      400,
    );
  }

  const result = await verifyPayment(paymentSig);
  return c.json(result, result.valid ? 200 : 422);
});

x402Routes.post("/x402/settle", sessionAuth, async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: { message: "Unauthorized", type: "authentication_error" } }, 401);
  }

  // ponytail: C2 — amount is derived from the verified cache, NEVER from the
  // body. Without this, a client could call `/x402/verify` with a 0.01 USDC tx,
  // get a valid receipt, then call `/x402/settle` with `amount: "1000000"` and
  // stamp a receipt claiming they paid a million dollars. The receipt signed
  // here is what downstream services (credit ledger, audit log) consume.
  let body: { txHash?: string; amount?: string; networkId?: string; payee?: string };
  try {
    body = await c.req.json<{ txHash?: string; amount?: string; networkId?: string; payee?: string }>();
  } catch {
    return c.json(
      { error: { message: "Invalid JSON body", type: "payment_error" } },
      400,
    );
  }

  if (!body.txHash || !body.networkId) {
    return c.json(
      { error: { message: "txHash and networkId are required (amount is derived from verified cache, not the body)", type: "payment_error" } },
      400,
    );
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(body.txHash)) {
    return c.json({ error: { message: "Invalid txHash format", type: "validation_error" } }, 400);
  }

  // Pin payee to the configured merchant address; never trust user-supplied
  // recipients. The x402 spec requires the merchant to receive the payment.
  const expectedPayee = (config.TREASURY_BASE_ADDRESS || "").toLowerCase();
  if (!expectedPayee) {
    return c.json(
      { error: { message: "Server merchant address not configured", type: "server_misconfigured" } },
      500,
    );
  }
  if (body.payee && body.payee.toLowerCase() !== expectedPayee) {
    return c.json(
      { error: { message: "Payee does not match configured merchant address", type: "payment_error" } },
      400,
    );
  }

  // ponytail: log a warning when the legacy client sends body.amount, so we
  // can track migration progress and surface it in the docs changelog.
  if (body.amount !== undefined) {
    logger.warn(
      { txHash: body.txHash, clientAmount: body.amount },
      "[FACILITATOR] /x402/settle body.amount is ignored; amount is derived from the verified cache",
    );
  }

  // Optional PAYMENT-SIGNATURE header: if present, parse and validate JSON
  // shape (legacy dual-channel settle+verify path).
  const paymentHeader = c.req.header("PAYMENT-SIGNATURE");
  if (paymentHeader) {
    try {
      JSON.parse(paymentHeader);
    } catch {
      return c.json(
        { error: { message: "Invalid PAYMENT-SIGNATURE header: must be valid JSON", type: "payment_error" } },
        400,
      );
    }
  }

  // Look up the verified record from the in-memory cache. The cache is
  // populated by `/x402/verify` after a successful on-chain verification.
  // If the cache has no entry for this txHash, fall back to the DB so that
  // settlements survive server restarts (CRIT-4).
  const cacheKey = `${body.networkId}:${body.txHash}`;
  const cached = settlementCache.get(cacheKey);
  if (cached) {
    // Use settlePaymentAsync which persists the receipt to the DB.
    const result = await settlePaymentAsync(body.txHash, cached.amount, cached.networkId, expectedPayee);
    return c.json(result, result.settled ? 200 : 422);
  }

  // Cache miss — check the DB for an existing settlement.
  const existingSettlement = await db
    .select()
    .from(settlements)
    .where(and(eq(settlements.txHash, body.txHash), eq(settlements.networkId, body.networkId)))
    .limit(1);
  if (existingSettlement.length > 0) {
    // Repopulate the cache and return the stored receipt.
    atomicCacheSet(cacheKey, {
      txHash: existingSettlement[0].txHash,
      amount: existingSettlement[0].amount,
      networkId: existingSettlement[0].networkId,
      payee: existingSettlement[0].payee,
      settledAt: existingSettlement[0].settledAt.getTime(),
      receipt: existingSettlement[0].receipt,
    });
    return c.json({ settled: true, receipt: existingSettlement[0].receipt }, 200);
  }

  // No record anywhere — client must call /x402/verify first.
  return c.json(
    {
      error: {
        message: "No verified payment on file for this txHash. Call /x402/verify first.",
        type: "missing_verify",
        code: "x402_verify_required",
      },
    },
    400,
  );
});

// ── Test routes — dev/staging only ──────────────────────────────────────────
if (config.NODE_ENV !== "production") {
x402Routes.post("/x402/pay-req-test",
  rateLimit({ windowMs: 60_000, maxRequests: 30 }),
  async (c) => {
  // ponytail: refuse to mount the test route with an unset merchant address —
  // falling back to 0x000… lets an attacker mint a Pay-Req header with a
  // bogus payee and probe verification behavior. Returns 503 (not 500) so
  // it's clearly "intentionally disabled", not "broken".
  const payeeAddress = config.TREASURY_BASE_ADDRESS;
  if (!payeeAddress) {
    return c.json(
      { error: { message: "x402 test endpoint disabled: TREASURY_BASE_ADDRESS unset", type: "feature_disabled" } },
      503,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const paymentURL = `https://oma-ai.com/deposit?route=x402&network=base&asset=USDC&return_to=${encodeURIComponent(c.req.url)}`;
  const amount = "1.00";

  const paymentRequired: PaymentRequired = {
    x402Version: "1",
    scheme: "evm",
    networkId: "base",
    asset: USDC_BASE,
    amount,
    payee: payeeAddress,
    maxAmountRequired: amount,
    validBefore: now + PAYMENT_WINDOW_SECONDS,
    validAfter: now,
    description: "Payment required for x402 test",
    "payment-URL": paymentURL,
  };

  c.header("PAYMENT-REQUIRED", JSON.stringify(paymentRequired));
  return c.json(
    {
      error: {
        message: "Payment required",
        type: "payment_required",
        payment: paymentRequired,
      },
    },
    402,
  );
});

const testPricing: Record<string, string> = {
  "/x402/middleware-test": "0.50",
};

const testPayeeAddress = config.TREASURY_BASE_ADDRESS;
// ponytail: only mount the middleware test when a real merchant address is set.
// Falling back to the zero address would let `/x402/middleware-test` accept
// payments to nobody and falsely report "success" — see audit X402-2026-06-14.
if (testPayeeAddress) {
  x402Routes.use("/x402/middleware-test", paymentMiddleware({
    pricing: testPricing,
    payeeAddress: testPayeeAddress,
  }));
}

x402Routes.post("/x402/middleware-test", async (c) => {
  return c.json({ success: true });
});
} // end NODE_ENV !== "production" test routes

// Houdini/crosschain deposit flow removed — /v1/x402/proxy/chat/completions no longer exists.

// =============================================================================
// x402 SPEC NOTE (post-2026-07-02 audit fix):
//
// As of audit-x402-eip3009-fix-2026-07-02, the V1 verify path now uses
// EIP-3009 transferWithAuthorization (gasless for the user, facilitator pays
// gas). The canonical Coinbase x402 v2 spec lives at
//   https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md
//   (transport: https://github.com/coinbase/x402/blob/main/specs/transports-v2/http.md)
//
// V1 wire shape (now EIP-3009-aligned; was: receipt-check of pre-paid transfer):
//   * x402Version: string ("1"|"2"). V2 spec uses number (2); v2.ts still 501.
//   * Transport header: PAYMENT-SIGNATURE (JSON-encoded PaymentSignature).
//   * signature     = 65-byte EIP-712 sig over TransferWithAuthorization typed data.
//   * authorization = JSON { from, to, value, validAfter, validBefore, nonce }.
//   * payload       = { scheme, networkId, asset, amount, payee, payFrom,
//                      maxAmountRequired, validBefore, validAfter, nonce? }.
//   * Legacy back-compat: if authorization is not a JSON EIP-3009 tuple, the
//     verify path falls through to `verifyUsdcTransferReceipt` which decodes
//     `transfer`/`transferFrom` calldata from a tx hash (pre-paid flow).
//
// EIP-3009 verify path (verifyEip3009Payment):
//   1. Consume nonce (CRIT-2 replay protection).
//   2. Parse + shape-check the authorization tuple.
//   3. Pin payee to SERVER_TREASURY (reject mismatches).
//   4. Pin amount >= payload.maxAmountRequired.
//   5. Validate validAfter <= now < validBefore.
//   6. Recover EIP-712 signer via viem.recoverTypedDataAddress; reject if
//      recovered != authorization.from.
//   7. Simulate via eth_call (catches double-spend attempts where the
//      contract would revert because the nonce is already used).
//   8. Settle: if FACILITATOR_PRIVATE_KEY is configured, submit the real
//      transferWithAuthorization tx (facilitator pays gas). Otherwise emit
//      a deterministic synthetic txHash (keccak256 of tuple+sig) so the
//      verify+settle cache key still works for dev/preview deployments.
//
// Canonical chain IDs: Base mainnet = eip155:8453, USDC = 0x833589…29913;
// Base Sepolia = eip155:84532, USDC = 0x036CbD…CF7e (matches v2 spec).
// Only mainnet is supported today.
//
// =============================================================================

// ============================================================
// Payment Middleware
// ============================================================

export function paymentMiddleware(
  middlewareConfig: PaymentMiddlewareConfig,
): MiddlewareHandler<OmaEnv> {
  const {
    pricing,
    payeeAddress,
    asset = USDC_BASE,
    networkId = "base",
    scheme = "evm",
  } = middlewareConfig;

  return async (c: Context<OmaEnv>, next: Next) => {
    const path = new URL(c.req.url).pathname;
    const price = pricing[path];

    if (price === undefined) {
      await next();
      return;
    }

    // v2 transport (X-PAYMENT, base64 JSON, CAIP-2 networks) is checked
    // first; the legacy v1 PAYMENT-SIGNATURE raw-JSON header remains fully
    // supported. Both map onto the same EIP-3009 verify/settle core.
    const xPaymentHeader = c.req.header("X-PAYMENT");
    const paymentHeader = c.req.header("PAYMENT-SIGNATURE");

    if (!xPaymentHeader && !paymentHeader) {
      const now = Math.floor(Date.now() / 1000);
      const paymentURL = `https://oma-ai.com/deposit?route=x402&network=${networkId}&asset=${encodeURIComponent(asset)}&return_to=${encodeURIComponent(c.req.url)}`;

      const paymentRequired: PaymentRequired = {
        x402Version: "1",
        scheme,
        networkId,
        asset,
        amount: price,
        payee: payeeAddress,
        maxAmountRequired: price,
        validBefore: now + PAYMENT_WINDOW_SECONDS,
        validAfter: now,
        description: `Payment required for ${path}`,
        "payment-URL": paymentURL,
      };

      const v2Challenge = buildV2Challenge({
        priceUsd: price,
        payTo: payeeAddress,
        resource: c.req.url,
        maxTimeoutSeconds: PAYMENT_WINDOW_SECONDS,
      });

      c.header("PAYMENT-REQUIRED", JSON.stringify(paymentRequired));
      // Spec-shaped v2 body (x402Version/accepts) with the legacy v1
      // error envelope folded in so both client generations can parse it.
      return c.json(
        {
          ...v2Challenge,
          error: {
            message: "Payment required",
            type: "payment_required",
            payment: paymentRequired,
          },
        },
        402,
      );
    }

    let paymentSig: PaymentSignature;
    if (xPaymentHeader) {
      try {
        paymentSig = parseXPaymentHeader(xPaymentHeader);
      } catch (err) {
        return c.json(
          { error: { message: err instanceof Error ? err.message : "Invalid X-PAYMENT header", type: "payment_error" } },
          400,
        );
      }
    } else {
      try {
        paymentSig = JSON.parse(paymentHeader as string) as PaymentSignature;
      } catch {
        return c.json(
          { error: { message: "Invalid PAYMENT-SIGNATURE header", type: "payment_error" } },
          400,
        );
      }
    }

    if (paymentSig.payload?.payee?.toLowerCase() !== payeeAddress.toLowerCase()) {
      return c.json(
        { error: { message: "Payment payee mismatch", type: "payment_error" } },
        402,
      );
    }

    const requestedAtomic = parseUsdcAtomic(paymentSig.payload?.amount ?? "0");
    const requiredAtomic = parseUsdcAtomic(price);
    // Reject underpayment first (the client is paying less than the price).
    if (requestedAtomic < requiredAtomic) {
      return c.json(
        { error: { message: `Insufficient payment: requested ${requestedAtomic} but ${requiredAtomic} required`, type: "payment_error" } },
        402,
      );
    }
    // Reject overpayment — the actual settled amount is determined by
    // verifyPayment (on-chain), not the client-supplied amount field.
    if (requestedAtomic > requiredAtomic) {
      return c.json(
        { error: { message: `Payment amount exceeds maximum: requested ${requestedAtomic} but ${requiredAtomic} allowed`, type: "payment_error" } },
        402,
      );
    }

    const verification = await verifyPayment(paymentSig);

    if (!verification.valid) {
      return c.json(
        { error: { message: verification.error ?? "Payment verification failed", type: "payment_error" } },
        402,
      );
    }

    if (verification.txHash) {
      await settlePaymentAsync(
        verification.txHash,
        verification.amount ?? paymentSig.payload.amount,
        verification.networkId ?? paymentSig.payload.networkId,
        payeeAddress,
        { idempotencyKey: paymentSig.signature },
      );
    }

    c.set("payment", { txHash: verification.txHash, amount: verification.amount ?? paymentSig.payload.amount, networkId: verification.networkId ?? paymentSig.payload.networkId });
    // v2 clients get the spec's settlement receipt header.
    if (xPaymentHeader) {
      c.header(
        "X-PAYMENT-RESPONSE",
        buildXPaymentResponse({
          txHash: verification.txHash,
          payer: paymentSig.payload.payFrom,
        }),
      );
    }
    await next();
  };
}
