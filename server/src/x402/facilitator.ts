import { Hono } from "hono";
import type { Context, Next, MiddlewareHandler } from "hono";
import { createPublicClient, http, formatUnits, decodeFunctionData, parseAbi, type Hash } from "viem";
import { base } from "viem/chains";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import type { OmaEnv } from "../types.js";
import { sessionAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { settlements } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { addSettlementToDlq } from "../lib/dlq.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { getRedisClient } from "../lib/redis-client.js";

const LOCK_TTL_SECONDS = 30;

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
// Types
// ============================================================

export type X402Version = "1" | "2";

interface SolanaInstruction {
  parsed?: {
    type: string;
    info: {
      destination?: string;
      lamports?: string;
      amount?: string;
      mint?: string;
      tokenAmount?: { amount?: string; decimals?: number };
    };
  };
}

interface SolanaRpcResponse {
  result?: {
    meta?: { err?: unknown };
    transaction?: {
      message?: {
        instructions?: SolanaInstruction[];
      };
    };
  };
  error?: { message?: string; code?: number };
}

export interface PaymentPayload {
  x402Version: X402Version;
  scheme: "evm" | "solana";
  networkId: string;
  asset: string;
  amount: string;
  payee: string;
  payFrom: string;
  maxAmountRequired: string;
  validBefore: number;
  validAfter: number;
  description?: string;
}

export interface PaymentSignature {
  x402Version: X402Version;
  signature: string;
  authorization: string;
  payload: PaymentPayload;
}

export interface PaymentRequired {
  x402Version: X402Version;
  scheme: "evm" | "solana";
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
  receipt: string;
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
  scheme?: "evm" | "solana";
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

setInterval(cleanExpiredCache, 300_000).unref();

// ============================================================
// Nonce Management
// ============================================================

// ============================================================
// Signing Utilities
// ============================================================

const RECEIPT_VERSION = "1";

function signReceipt(data: string): string {
  const secret = config.RECEIPT_HMAC_SECRET;
  if (!secret) {
    throw new Error("RECEIPT_HMAC_SECRET is not configured");
  }
  const hmac = createHmac("sha256", secret);
  hmac.update(data);
  return hmac.digest("hex");
}

function verifyReceipt(
  data: string,
  receipt: string,
  receiptExpiry?: number
): boolean {
  if (receiptExpiry !== undefined && Date.now() > receiptExpiry * 1000) {
    return false;
  }
  const expected = signReceipt(data);
  const expectedBuf = Buffer.from(expected, "utf8");
  const receiptBuf = Buffer.from(receipt, "utf8");
  const len = Math.max(expectedBuf.length, receiptBuf.length);
  const aPadded = Buffer.alloc(len);
  const bPadded = Buffer.alloc(len);
  expectedBuf.copy(aPadded);
  receiptBuf.copy(bPadded);
  return timingSafeEqual(aPadded, bPadded);
}

function createReceiptPayload(
  txHash: string,
  amount: string,
  networkId: string,
  payee: string,
  settledAt: number,
): string {
  const expiryTime = Math.floor(settledAt / 1000) + RECEIPT_EXPIRY_SECONDS;
  return `${RECEIPT_VERSION}:${txHash}:${amount}:${networkId}:${payee}:${settledAt}:${expiryTime}`;
}

// ============================================================
// EVM Verification (Base)
// ============================================================

import { USDC_BASE, USDC_DECIMALS, CACHE_TTL_MS, RECEIPT_EXPIRY_SECONDS } from "../constants.js";

const EVM_PUBLIC_RPC_FALLBACK = "https://base-rpc.publicnode.com";
const SOLANA_PUBLIC_RPC_FALLBACK = "https://rpc.ankr.com/solana";

async function fetchWithFallback(
  url: string,
  fallbackUrl: string | undefined,
  fallbackDisplay: string,
  request: RequestInit,
): Promise<Response> {
  try {
    const response = await fetch(url, request);
    return response;
  } catch {
    if (!fallbackUrl) {
      console.warn(`[FACILITATOR] [WARN] Primary RPC failed (${url}), trying public fallback: ${fallbackDisplay}`);
      const fallbackResponse = await fetch(fallbackDisplay, request);
      return fallbackResponse;
    }
    console.warn(`[FACILITATOR] [WARN] Primary RPC failed (${url}), trying fallback: ${fallbackUrl}`);
    const fallbackResponse = await fetch(fallbackUrl, request);
    return fallbackResponse;
  }
}

async function verifyEvmPayment(
  signature: string,
  authorization: string,
  payload: PaymentPayload,
): Promise<PaymentResponse> {
  const txHash = signature.startsWith("0x")
    ? (signature as Hash)
    : (`0x${signature}` as Hash);

  async function attemptVerification(rpcUrl: string, fallbackRpcUrl: string | undefined): Promise<PaymentResponse> {
    const isFallback = rpcUrl !== config.CHAIN_RPC_URL;
    if (isFallback && fallbackRpcUrl) {
      console.warn(`[FACILITATOR] [WARN] EVM RPC fallback active: ${rpcUrl}`);
    }

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    });

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
          const amount = formatUnits(rawAmount, USDC_DECIMALS);
          const actualAmount = parseFloat(amount);
          const requiredAmount = parseFloat(payload.maxAmountRequired || payload.amount || "0");

          if (actualAmount < requiredAmount) {
            return { valid: false, error: `Insufficient payment: ${actualAmount} < ${requiredAmount}` };
          }

          if (recipient.toLowerCase() !== payeeLower) {
            return { valid: false, error: "Recipient mismatch" };
          }

          return {
            valid: true,
            txHash,
            amount,
            networkId: payload.networkId,
          };
        }

        if (decoded.functionName === "transferFrom") {
          const [, recipient, rawAmount] = decoded.args as [string, string, bigint];
          const amount = formatUnits(rawAmount, USDC_DECIMALS);
          const actualAmount = parseFloat(amount);
          const requiredAmount = parseFloat(payload.maxAmountRequired || payload.amount || "0");

          if (actualAmount < requiredAmount) {
            return { valid: false, error: `Insufficient payment: ${actualAmount} < ${requiredAmount}` };
          }

          if (recipient.toLowerCase() !== payeeLower) {
            return { valid: false, error: "Recipient mismatch" };
          }

          return {
            valid: true,
            txHash,
            amount,
            networkId: payload.networkId,
          };
        }
      } catch (decodeErr) {
        console.error(`[facilitator] Failed to decode USDC transfer data:`, decodeErr);
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

  try {
    return await attemptVerification(config.CHAIN_RPC_URL, config.CHAIN_RPC_URL_FALLBACK);
  } catch (primaryErr: unknown) {
    const isNetworkError = primaryErr instanceof Error && (
      primaryErr.message.includes("fetch") ||
      primaryErr.message.includes("ECONNREFUSED") ||
      primaryErr.message.includes("ETIMEDOUT") ||
      primaryErr.message.includes("network") ||
      primaryErr.message.includes("timeout") ||
      primaryErr.name === "TypeError"
    );

    console.error(`[facilitator] EVM verification error:`, primaryErr);
    if (!isNetworkError) {
      return { valid: false, error: `EVM verification failed` };
    }

    if (config.CHAIN_RPC_URL_FALLBACK) {
      try {
        return await attemptVerification(config.CHAIN_RPC_URL_FALLBACK, undefined);
      } catch {
        return { valid: false, error: `EVM verification failed` };
      }
    }

    try {
      return await attemptVerification(EVM_PUBLIC_RPC_FALLBACK, undefined);
    } catch {
      return { valid: false, error: `EVM verification failed` };
    }
  }
}

// ============================================================
// Solana Verification (Simplified)
// ============================================================

const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

async function verifySolanaPayment(
  signature: string,
  _authorization: string,
  payload: PaymentPayload,
): Promise<PaymentResponse> {
  async function attemptVerification(rpcUrl: string): Promise<PaymentResponse> {
    const response = await fetchWithFallback(
      rpcUrl,
      config.SOLANA_RPC_URL_FALLBACK,
      SOLANA_PUBLIC_RPC_FALLBACK,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [
            signature,
            { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
          ],
        }),
      },
    );

    if (!response.ok) {
      return { valid: false, error: "Solana RPC request failed" };
    }

    const json = (await response.json()) as SolanaRpcResponse;

    if (json.error) {
      console.error(`[facilitator] Solana RPC error:`, json.error);
      return { valid: false, error: `Solana RPC error` };
    }

    const tx = json.result;
    if (!tx || !tx.meta || tx.meta.err) {
      return { valid: false, error: "Transaction not found or failed on Solana" };
    }

    const instructions = tx.transaction?.message?.instructions ?? [];
    const allInstructions: SolanaInstruction[] = [...instructions];

    const innerIxs = (tx.meta as { innerInstructions?: Array<{ instructions: SolanaInstruction[] }> } | undefined)?.innerInstructions ?? [];
    for (const innerGroup of innerIxs) {
      if (innerGroup.instructions) {
        allInstructions.push(...innerGroup.instructions);
      }
    }

    let foundTransfer = false;
    let amount = "0";

    const requiredAmount = parseFloat(payload.maxAmountRequired || payload.amount || "0");

    for (const ix of allInstructions) {
      if (
        ix.parsed?.type === "transfer" &&
        ix.parsed?.info?.destination === payload.payee
      ) {
        const isUsdc = payload.asset === SOLANA_USDC || payload.asset.toLowerCase().includes("usdc");
        const divisor = isUsdc ? 1e6 : 1e9;
        const rawAmt = Number(ix.parsed.info.lamports || ix.parsed.info.amount || 0);
        amount = (rawAmt / divisor).toString();
        const actualAmount = parseFloat(amount);

        if (actualAmount < requiredAmount) {
          return { valid: false, error: `Insufficient payment: ${actualAmount} < ${requiredAmount}` };
        }

        foundTransfer = true;
        break;
      }
      if (
        ix.parsed?.type === "transferChecked" &&
        ix.parsed?.info?.destination === payload.payee
      ) {
        const rawAmount = Number(ix.parsed.info.tokenAmount?.amount || ix.parsed.info.amount || 0);
        const decimals = ix.parsed.info.tokenAmount?.decimals ?? 6;
        amount = (rawAmount / Math.pow(10, decimals)).toString();
        const actualAmount = parseFloat(amount);

        if (actualAmount < requiredAmount) {
          return { valid: false, error: `Insufficient payment: ${actualAmount} < ${requiredAmount}` };
        }

        foundTransfer = true;
        break;
      }
    }

    if (!foundTransfer) {
      return { valid: false, error: "No matching USDC transfer to payee found" };
    }

    return {
      valid: true,
      txHash: signature,
      amount,
      networkId: payload.networkId,
    };
  }

  try {
    return await attemptVerification(config.SOLANA_RPC_URL);
  } catch (err: unknown) {
    console.error(`[facilitator] Solana verification failed:`, err);
    return { valid: false, error: `Solana verification failed` };
  }
}

// ============================================================
// Mock Verification (DEVELOPMENT ONLY)
// ============================================================
// WARNING: Mock mode accepts ANY payment as valid without on-chain
// verification. This is safe ONLY because config.ts throws a fatal
// error if FACILITATOR_MODE=mock is used in production or staging.
// See: config.ts line ~41-43

function mockVerifyPayment(
  signature: string,
  payload: PaymentPayload,
): PaymentResponse {
  console.warn(
    `[FACILITATOR] [WARN] Mock-mode verification accepted -- signature=${signature.slice(0, 16)}... scheme=${payload.scheme} amount=${payload.amount}`,
  );

  const mockTxHash =
    payload.scheme === "evm"
      ? `0x${randomBytes(32).toString("hex")}`
      : signature || randomBytes(64).toString("base64url");

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
  const cacheKey = `${payload.scheme}:${signature}`;

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
    console.warn("[FACILITATOR] [WARN] Processing payment in mock mode -- signatures are NOT verified on-chain");
    return mockVerifyPayment(signature, payload);
  }

  if (payload.scheme === "evm") {
    return verifyEvmPayment(signature, authorization, payload);
  }

  if (payload.scheme === "solana") {
    return verifySolanaPayment(signature, authorization, payload);
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
  if (existing) {
    return { settled: true, receipt: existing.receipt };
  }

  const lockAcquired = await acquireSettlementLock(cacheKey);
  if (!lockAcquired) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const existingAfterLock = settlementCache.get(cacheKey);
    if (existingAfterLock) {
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

        atomicCacheSet(cacheKey, record);

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
            console.error(`Failed to persist settlement to DB (attempt ${attempt}/3):`, lastError);
            if (attempt < 3) {
              const backoffMs = Math.min(100 * Math.pow(2, attempt - 1), 1000);
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
            }
          }
        }

        if (!result) {
          while (cacheLock) {
            new Promise((resolve) => setTimeout(resolve, 1));
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
  if (existing) {
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
  if (cached) {
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

  const body = await c.req.json<{ txHash?: string; amount?: string; networkId?: string; payee?: string }>();

  if (!body.txHash || !body.amount || !body.networkId || !body.payee) {
    return c.json(
      { error: { message: "txHash, amount, networkId, and payee are required", type: "payment_error" } },
      400,
    );
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(body.txHash)) {
    return c.json({ error: { message: "Invalid txHash format", type: "validation_error" } }, 400);
  }

  const result = settlePayment(body.txHash, body.amount, body.networkId, body.payee);
  return c.json(result, result.settled ? 200 : 422);
});

x402Routes.post("/x402/pay-req-test", async (c) => {
  const now = Math.floor(Date.now() / 1000);
  const paymentURL = `https://pay.om.ai/x402/deposit?network=base&asset=USDC&return_to=${encodeURIComponent(c.req.url)}`;
  const paymentRequired: PaymentRequired = {
    x402Version: "1",
    scheme: "evm",
    networkId: "base",
    asset: USDC_BASE,
    amount: "1.00",
    payee: config.HOUDINI_ADDRESS_TO || "0x0000000000000000000000000000000000000000",
    maxAmountRequired: "1.00",
    validBefore: now + PAYMENT_WINDOW_SECONDS,
    validAfter: now,
    description: "Payment required for x402 test",
    "payment-URL": paymentURL,
  };

  c.header("Pay-Req", JSON.stringify(paymentRequired));
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

x402Routes.use("/x402/middleware-test", paymentMiddleware({
  pricing: testPricing,
  payeeAddress: config.HOUDINI_ADDRESS_TO || "0x0000000000000000000000000000000000000000",
}));

x402Routes.post("/x402/middleware-test", async (c) => {
  return c.json({ success: true });
});

// ============================================================
// Payment Middleware
// ============================================================

export function paymentMiddleware(
  middlewareConfig: PaymentMiddlewareConfig,
): MiddlewareHandler<OmaEnv> {
  const {
    pricing,
    payeeAddress,
    asset = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
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

    const paymentHeader = c.req.header("PAYMENT-SIGNATURE");

    if (!paymentHeader) {
      const now = Math.floor(Date.now() / 1000);
      const paymentURL = `https://pay.om.ai/x402/deposit?network=${networkId}&asset=${encodeURIComponent(asset)}&return_to=${encodeURIComponent(c.req.url)}`;
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

      c.header("Pay-Req", JSON.stringify(paymentRequired));
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
    }

    let paymentSig: PaymentSignature;
    try {
      paymentSig = JSON.parse(paymentHeader) as PaymentSignature;
    } catch {
      return c.json(
        { error: { message: "Invalid PAYMENT-SIGNATURE header", type: "payment_error" } },
        400,
      );
    }

    if (
      paymentSig.payload?.payee?.toLowerCase() !== payeeAddress.toLowerCase() &&
      paymentSig.payload?.payee !== payeeAddress
    ) {
      return c.json(
        { error: { message: "Payment payee mismatch", type: "payment_error" } },
        402,
      );
    }

    const requestedAmount = parseFloat(paymentSig.payload?.amount ?? "0");
    const requiredAmount = parseFloat(price);
    if (requestedAmount < requiredAmount) {
      return c.json(
        { error: { message: `Insufficient payment: ${requestedAmount} < ${requiredAmount}`, type: "payment_error" } },
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
    await next();
  };
}
