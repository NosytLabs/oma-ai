import { CACHE_TTL_MS } from "../constants.js";
import type { PaymentPayload, PaymentResponse, SettlementRecord } from "./types.js";

// ============================================================
// Settlement Cache (Thread-safe LRU with max size)
// ============================================================

export const settlementCache = new Map<string, SettlementRecord>();
const cacheAccessOrder: string[] = [];
const MAX_CACHE_SIZE = 1_000;
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

export function atomicCacheSet(cacheKey: string, record: SettlementRecord): void {
  if (cacheLock) {
    setTimeout(() => {
      try {
        atomicCacheSet(cacheKey, record);
      } catch (err) {
        console.error("atomicCacheSet timeout failed", err);
      }
    }, 0);
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

/**
 * Remove an entry under the cache lock. Used by the settlement path to roll
 * back a cached record when DB persistence ultimately fails — waits for any
 * in-flight atomicCacheSet to finish first.
 */
export async function atomicCacheDelete(cacheKey: string): Promise<void> {
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
}

export function getSettlementCacheKey(networkId: string, txHash: string): string {
  return `${networkId}:${txHash.toLowerCase()}`;
}

export function getVerificationCacheKey(payload: PaymentPayload, signature: string): string {
  return `verify:${payload.scheme}:${payload.networkId}:${payload.nonce ?? "missing"}:${signature}`;
}

export function cacheVerifiedRecord(
  payload: PaymentPayload,
  result: PaymentResponse,
  signature?: string,
): void {
  if (result.valid && result.txHash) {
    const record: SettlementRecord = {
      txHash: result.txHash,
      amount: result.amount ?? payload.amount,
      networkId: result.networkId ?? payload.networkId,
      payee: payload.payee,
      settledAt: Date.now(),
    };
    atomicCacheSet(getSettlementCacheKey(payload.networkId, result.txHash), record);
    if (signature) {
      atomicCacheSet(getVerificationCacheKey(payload, signature), record);
    }
  }
}

setInterval(cleanExpiredCache, 300_000).unref();
