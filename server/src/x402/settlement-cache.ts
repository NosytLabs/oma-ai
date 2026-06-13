import { getRedisClient } from "../lib/redis-client.js";
import { CACHE_TTL_MS } from "../constants.js";
import type { SettlementRecord } from "./types.js";

const LOCK_TTL_SECONDS = 30;

export async function acquireSettlementLock(cacheKey: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return true;
  const lockKey = `settlement:lock:${cacheKey}`;
  const result = await redis.set(lockKey, "1", { NX: true, EX: LOCK_TTL_SECONDS });
  return result === "OK";
}

export async function releaseSettlementLock(cacheKey: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;
  const lockKey = `settlement:lock:${cacheKey}`;
  await redis.del(lockKey);
}

// ============================================================
// Settlement Cache (Thread-safe LRU with max size)
// ============================================================
//
// C1: per-key async mutex replacing the racy `cacheLock` boolean. The
// previous implementation used a module-level boolean `cacheLock` plus
// `setTimeout(..., 0)` to "queue" callers, which (a) was not actually
// FIFO, (b) dropped the queue head on busy event loops, and (c) could
// race on the settlementCache map itself outside the critical section.
// We now use a Promise-chain pattern keyed by cacheKey: every mutator
// appends a continuation to the per-key chain, guaranteeing serial
// execution. The Redis SET NX EX is the cross-process second line of
// defence (see acquireSettlementLock in facilitator.ts).
//
// C3/C4: cache key now includes amount + payee + networkId, and the
// map is bounded by MAX_CACHE_SIZE with strict LRU eviction. Without
// these, an attacker could poison the cache by submitting a cheap tx
// (e.g. 0.01 USDC) under a real signature, then replaying the same
// signature for a different priced resource — the cached "valid"
// response would short-circuit verification.

export const settlementCache = new Map<string, SettlementRecord>();
export const cacheAccessOrder: string[] = [];
export const MAX_CACHE_SIZE = 1_000;
export const PAYMENT_WINDOW_SECONDS = 300;

// Per-key mutex chain. Each cacheKey maps to a Promise that resolves
// when all prior critical sections for that key have completed.
const cacheMutexChains: Map<string, Promise<void>> = new Map();

/**
 * Acquire the per-key async mutex. The returned `release` MUST be
 * called to let the next waiter proceed.
 */
export async function acquireCacheLock(cacheKey: string): Promise<() => void> {
  const previous = cacheMutexChains.get(cacheKey) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Chain: wait for previous, then install ourselves.
  cacheMutexChains.set(
    cacheKey,
    previous.then(() => current),
  );
  // Wait for any prior holder, but DON'T await `current` (that would
  // deadlock). This is the standard promise-chain mutex idiom.
  await previous;
  return () => {
    release();
    // Best-effort cleanup so the map doesn't grow unbounded.
    if (cacheMutexChains.get(cacheKey) === previous.then(() => current)) {
      cacheMutexChains.delete(cacheKey);
    }
  };
}

export function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, record] of settlementCache) {
    if (now - record.settledAt > CACHE_TTL_MS) {
      settlementCache.delete(key);
      const idx = cacheAccessOrder.indexOf(key);
      if (idx !== -1) cacheAccessOrder.splice(idx, 1);
    }
  }
}

export function evictLRU(): void {
  // C3/C4: strict LRU cap at MAX_CACHE_SIZE; evict the oldest
  // accessed key when the map is at the cap and a new key would push
  // it over.
  while (settlementCache.size >= MAX_CACHE_SIZE && cacheAccessOrder.length > 0) {
    const firstKey = cacheAccessOrder.shift();
    if (firstKey !== undefined) {
      settlementCache.delete(firstKey);
    }
  }
}

/**
 * C1: set a cache entry under the per-key async mutex. Mutators MUST
 * be serialised per cacheKey so that the LRU bookkeeping, the map
 * write, and the access-order list cannot interleave.
 */
export async function atomicCacheSet(cacheKey: string, record: SettlementRecord): Promise<void> {
  const release = await acquireCacheLock(cacheKey);
  try {
    evictLRU();
    settlementCache.set(cacheKey, record);
    // Move the key to the back of the access list (LRU update).
    const idx = cacheAccessOrder.indexOf(cacheKey);
    if (idx !== -1) cacheAccessOrder.splice(idx, 1);
    cacheAccessOrder.push(cacheKey);
  } finally {
    release();
  }
}

/**
 * C1: delete a cache entry under the per-key async mutex.
 */
export async function atomicCacheDelete(cacheKey: string): Promise<void> {
  const release = await acquireCacheLock(cacheKey);
  try {
    settlementCache.delete(cacheKey);
    const idx = cacheAccessOrder.indexOf(cacheKey);
    if (idx !== -1) cacheAccessOrder.splice(idx, 1);
  } finally {
    release();
  }
}

setInterval(cleanExpiredCache, 300_000).unref();
