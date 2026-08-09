import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { settlements } from "../db/schema.js";
import { addSettlementToDlq } from "../lib/dlq.js";
import { logger } from "../lib/logger.js";
import { getRedisClient } from "../lib/redis-client.js";
import {
  createReceiptPayload,
  signReceipt,
  verifyReceipt,
} from "./facilitator-signing.js";
import {
  atomicCacheDelete,
  atomicCacheSet,
  getSettlementCacheKey,
  settlementCache,
} from "./settlement-cache.js";
import type { SettlementRecord, SettlementResponse } from "./types.js";

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
  const cacheKey = getSettlementCacheKey(networkId, txHash);

  const existing = settlementCache.get(cacheKey);
  // a cached verified record (no receipt) is NOT a settled record;
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
            logger.info(
              { txHash, amount, networkId, payee, attempt },
              "[FACILITATOR] Settlement persisted to DB",
            );
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
          await atomicCacheDelete(cacheKey);
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
  const cacheKey = getSettlementCacheKey(networkId, txHash);

  const existing = settlementCache.get(cacheKey);
  // C2 — only short-circuit on cache hit if the existing record is a
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
  const cacheKey = getSettlementCacheKey(networkId, txHash);
  if (settlementCache.has(cacheKey)) {
    return true;
  }
  const existing = await db.select().from(settlements).where(and(eq(settlements.txHash, txHash), eq(settlements.networkId, networkId))).limit(1);
  return existing.length > 0;
}

export function isSettled(txHash: string, networkId: string): boolean {
  return settlementCache.has(getSettlementCacheKey(networkId, txHash));
}

export async function getSettlementReceiptAsync(txHash: string, networkId: string): Promise<string | null> {
  const cacheKey = getSettlementCacheKey(networkId, txHash);
  const cached = settlementCache.get(cacheKey);
  if (cached?.receipt) {
    return cached.receipt;
  }
  const existing = await db.select().from(settlements).where(and(eq(settlements.txHash, txHash), eq(settlements.networkId, networkId))).limit(1);
  return existing[0]?.receipt ?? null;
}

export function getSettlementReceipt(txHash: string, networkId: string): string | null {
  const record = settlementCache.get(getSettlementCacheKey(networkId, txHash));
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
