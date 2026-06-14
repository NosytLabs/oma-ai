/**
 * M10.8 — Provider model list cache (5-minute TTL).
 *
 * Wraps upstream `/v1/models` fetches with a two-tier cache:
 *   L1: per-process in-memory Map (sub-microsecond hits, no I/O)
 *   L2: Redis (cross-replica, durable through single-replica restarts)
 *
 * Cache key:  `model-list:${provider}`  (e.g., `model-list:venice`)
 * TTL:        300 seconds (5 minutes)
 * Serialization: JSON (provider model lists are small — <100 entries typically)
 *
 * On Redis failure, the cache silently falls back to the in-memory L1
 * (which is unaffected) and the caller re-fetches upstream. On Redis
 * unavailability, the caller sees the same behavior as if there were
 * no L2 at all — never an error.
 */
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { logger } from "../lib/logger.js";

const DEFAULT_TTL_SECONDS = 300; // 5 minutes per M10.8 spec
const KEY_PREFIX = "model-list:";

/**
 * Serializable model-list shape. We accept any object shape the caller
 * wants to cache, so this isn't strict — it's a hint for documentation.
 * For OMA's `listModels()` the shape is `Array<{ id, category, ... }>`.
 */
export type ModelList = ReadonlyArray<Record<string, unknown>>;

interface L1Entry {
  models: ModelList;
  expiresAtMs: number;
}

// L1 in-memory cache. Bounded at L1_MAX_ENTRIES to prevent unbounded
// growth in providers-misuse scenarios. The LRU eviction is oldest-
// insertion-order, similar to stream-tracker's estimate cache.
const L1_MAX_ENTRIES = 64;
const l1Cache = new Map<string, L1Entry>();

function l1Key(provider: string): string {
  return `${KEY_PREFIX}${provider}`;
}

function evictOldestL1(): void {
  if (l1Cache.size < L1_MAX_ENTRIES) return;
  const firstKey = l1Cache.keys().next().value;
  if (firstKey !== undefined) l1Cache.delete(firstKey);
}

/**
 * Read the model list for a provider, returning null on miss.
 * Checks L1 first, then L2 (Redis). On any Redis error, falls back
 * to "miss" and the caller should re-fetch upstream.
 */
export async function getCachedModelList(
  provider: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<ModelList | null> {
  const key = l1Key(provider);

  // L1: in-memory
  const l1 = l1Cache.get(key);
  if (l1 && l1.expiresAtMs > Date.now()) {
    return l1.models;
  }
  // L1 expired or missing — drop the stale entry
  if (l1) l1Cache.delete(key);

  // L2: Redis
  if (!isRedisReady()) {
    return null;
  }
  const client = await getRedisClient();
  if (!client) {
    return null;
  }
  try {
    const raw = await client.get(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { models: ModelList; expiresAtMs: number };
    // Use the TTL derived from the stored envelope if present, else
    // trust the configured ttlSeconds.
    const effectiveTtlMs = parsed.expiresAtMs
      ? parsed.expiresAtMs - Date.now()
      : ttlSeconds * 1000;
    if (effectiveTtlMs <= 0) {
      // Server-side TTL was respected by Redis (key was already gone
      // by the time we got here) OR the envelope is past-due. Drop.
      return null;
    }
    // Repopulate L1
    evictOldestL1();
    l1Cache.set(key, { models: parsed.models, expiresAtMs: Date.now() + effectiveTtlMs });
    return parsed.models;
  } catch (err) {
    logger.warn({ provider, err: err instanceof Error ? err.message : String(err) }, "model-list-cache: Redis get failed");
    return null;
  }
}

/**
 * Store the model list for a provider with the given TTL (default 5 min).
 * Writes to both L1 and L2. L2 failures are logged but never thrown — the
 * caller has already produced the upstream response and should not fail
 * the user-facing request because a cache write failed.
 */
export async function setCachedModelList(
  provider: string,
  models: ModelList,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const key = l1Key(provider);
  const expiresAtMs = Date.now() + ttlSeconds * 1000;

  // L1: always write
  evictOldestL1();
  l1Cache.set(key, { models, expiresAtMs });

  // L2: best-effort write
  if (!isRedisReady()) {
    return;
  }
  const client = await getRedisClient();
  if (!client) {
    return;
  }
  try {
    const envelope = JSON.stringify({ models, expiresAtMs });
    await client.set(key, envelope, { EX: ttlSeconds });
  } catch (err) {
    logger.warn({ provider, err: err instanceof Error ? err.message : String(err) }, "model-list-cache: Redis set failed");
  }
}

/**
 * Invalidate a single provider's cached entry (both L1 and L2).
 * Useful when an admin operation changes the catalog and we want
 * downstream consumers to see the new list on their next request
 * instead of waiting up to 5 minutes.
 */
export async function invalidateCachedModelList(provider: string): Promise<void> {
  const key = l1Key(provider);
  l1Cache.delete(key);
  if (!isRedisReady()) return;
  const client = await getRedisClient();
  if (!client) return;
  try {
    await client.del(key);
  } catch (err) {
    logger.warn({ provider, err: err instanceof Error ? err.message : String(err) }, "model-list-cache: Redis del failed");
  }
}

/**
 * Test-only: clear the in-memory L1 cache. Does not affect Redis.
 */
export function clearL1Cache(): void {
  l1Cache.clear();
}

/**
 * Test-only: read the current size of the L1 cache.
 */
export function getL1CacheSize(): number {
  return l1Cache.size;
}
