/**
 * Channel Affinity Cache (M10.1)
 *
 * Cherry-picked from new-api/controller/channel_affinity_cache.go
 * (QuantumNous/new-api, github.com/QuantumNous/new-api).
 *
 * Design:
 *   - Stickiness: same user+model → same provider for TTL=1h
 *   - L1: in-process Map<key, {provider, expiresAt}> (zero-latency, no Redis roundtrip)
 *   - L2: Redis JSON blob at `affinity:${userId}:${modelId}` (survives restart, shared across replicas)
 *   - Fall-through: on cache miss/expired, caller proceeds with normal selectProvider
 *   - Admin override: clearAffinity() to manually reset (e.g. provider outage, model swap)
 *
 * Why sticky?
 *   - Many upstream providers cache KV state per-deployed-model; round-robining
 *     a single user across providers causes cold-cache penalty on every request
 *   - Rate-limit bursts are bounded per-(user,provider), not per-provider
 *   - x402 receipts stay coherent for repeat callers
 *
 * Why Redis+L1 (not L1-only)?
 *   - L1 is lost on restart; with 4-8 replicas it would diverge
 *   - Redis is already wired (provider-health.ts uses getRedisClient + isRedisReady)
 *
 * Failure mode:
 *   - Redis down → L1 still works; L2 read errors are swallowed, write errors are logged
 *   - Cache returns null → caller falls through to weighted/primary selection (correct)
 *
 * Invalidation:
 *   - Time-based: expiresAt checked on every get
 *   - Manual: clearAffinity(userId, modelId) — admin endpoint (not in M10.1 scope)
 *
 * Note: this module does NOT call isProviderAvailable itself. The caller
 * (provider-selector) checks liveness AFTER pulling the sticky value. This
 * keeps affinity pure: it answers "who did this user use last?" not
 * "is that provider still up?".
 */

import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { logger } from "../lib/logger.js";
import { config } from "../config.js";

export type Provider =
  | "venice"
  | "antseed"
  | "litellm"
  | "openrouter"
  | "together"
  | "deepinfra"
  | "surplus"
  | "morpheus";

/** Provider union must match provider-selector.ts (8 providers). */

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour, per new-api default
const L1_MAX_ENTRIES = 10_000; // cap to prevent unbounded growth

interface AffinityEntry {
  provider: Provider;
  expiresAt: number; // epoch ms
}

/**
 * In-process L1 cache. Keyed by `${userId}:${modelId}`.
 * Trimmed opportunistically on every set.
 */
const l1Cache = new Map<string, AffinityEntry>();

function l1Key(userId: string, modelId: string): string {
  return `${userId}:${modelId}`;
}

function redisKey(userId: string, modelId: string): string {
  return `affinity:${userId}:${modelId}`;
}

function ttlMs(): number {
  const v = config.AFFINITY_TTL_MS;
  if (typeof v === "number" && v > 0 && v <= 24 * 60 * 60 * 1000) return v;
  return DEFAULT_TTL_MS;
}

function trimL1(): void {
  if (l1Cache.size <= L1_MAX_ENTRIES) return;
  // Evict oldest entries (Map iteration is insertion order)
  const toRemove = l1Cache.size - L1_MAX_ENTRIES;
  let i = 0;
  for (const key of l1Cache.keys()) {
    if (i >= toRemove) break;
    l1Cache.delete(key);
    i++;
  }
}

function isValidProvider(p: unknown): p is Provider {
  return (
    p === "venice" ||
    p === "antseed" ||
    p === "litellm" ||
    p === "openrouter" ||
    p === "together" ||
    p === "deepinfra" ||
    p === "surplus" ||
    p === "morpheus"
  );
}

function parseEntry(raw: unknown): AffinityEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!isValidProvider(obj.provider)) return null;
  if (typeof obj.expiresAt !== "number" || !Number.isFinite(obj.expiresAt)) return null;
  return { provider: obj.provider, expiresAt: obj.expiresAt };
}

function isExpired(entry: AffinityEntry, now: number): boolean {
  return entry.expiresAt <= now;
}

/**
 * Look up the sticky provider for a (userId, modelId) pair.
 *
 * @returns Provider if a non-expired entry exists, null otherwise.
 *          Null is a signal to the caller to fall through to normal selection.
 */
export async function getAffinity(
  userId: string,
  modelId: string
): Promise<Provider | null> {
  if (!userId || !modelId) return null;
  const now = Date.now();
  const k = l1Key(userId, modelId);

  // L1: in-process
  const l1 = l1Cache.get(k);
  if (l1) {
    if (isExpired(l1, now)) {
      l1Cache.delete(k);
    } else {
      return l1.provider;
    }
  }

  // L2: Redis (if ready)
  if (!isRedisReady()) return null;
  let client: Awaited<ReturnType<typeof getRedisClient>>;
  try {
    client = await getRedisClient();
  } catch {
    return null;
  }
  if (!client) return null;

  try {
    const raw = await client.get(redisKey(userId, modelId));
    if (!raw) return null;
    const parsed = parseEntry(JSON.parse(raw));
    if (!parsed) return null;
    if (isExpired(parsed, now)) {
      // Best-effort cleanup; ignore errors
      try {
        await client.del(redisKey(userId, modelId));
      } catch {
        /* ignore */
      }
      return null;
    }
    // Backfill L1
    l1Cache.set(k, parsed);
    trimL1();
    return parsed.provider;
  } catch (err) {
    logger.warn(
      { err, userId, modelId, type: "affinity_get_failed" },
      "[affinity] Redis get failed, falling through"
    );
    return null;
  }
}

/**
 * Persist a (userId, modelId) → provider sticky mapping for the configured TTL.
 *
 * Idempotent: calling twice with the same args just resets the expiry.
 * Writes to L1 first (synchronous), then L2 (best-effort).
 */
export async function setAffinity(
  userId: string,
  modelId: string,
  provider: Provider
): Promise<void> {
  if (!userId || !modelId) return;
  if (!isValidProvider(provider)) {
    logger.warn(
      { userId, modelId, provider, type: "affinity_set_invalid" },
      "[affinity] Refusing to set invalid provider"
    );
    return;
  }
  const entry: AffinityEntry = { provider, expiresAt: Date.now() + ttlMs() };
  l1Cache.set(l1Key(userId, modelId), entry);
  trimL1();

  if (!isRedisReady()) return;
  let client: Awaited<ReturnType<typeof getRedisClient>>;
  try {
    client = await getRedisClient();
  } catch {
    return;
  }
  if (!client) return;

  try {
    const seconds = Math.max(1, Math.ceil(ttlMs() / 1000));
    await client.set(redisKey(userId, modelId), JSON.stringify(entry), {
      EX: seconds,
    });
  } catch (err) {
    logger.warn(
      { err, userId, modelId, provider, type: "affinity_set_failed" },
      "[affinity] Redis set failed (L1 still warm)"
    );
  }
}

/**
 * Manually invalidate an affinity entry (admin override).
 *
 * Clears both L1 and L2. Idempotent: no error if entry doesn't exist.
 */
export async function clearAffinity(
  userId: string,
  modelId: string
): Promise<void> {
  if (!userId || !modelId) return;
  l1Cache.delete(l1Key(userId, modelId));

  if (!isRedisReady()) return;
  let client: Awaited<ReturnType<typeof getRedisClient>>;
  try {
    client = await getRedisClient();
  } catch {
    return;
  }
  if (!client) return;

  try {
    await client.del(redisKey(userId, modelId));
  } catch (err) {
    logger.warn(
      { err, userId, modelId, type: "affinity_clear_failed" },
      "[affinity] Redis del failed (L1 already cleared)"
    );
  }
}

/**
 * Test-only: clear in-process L1. NOT exported in the public API.
 * Used by isolated tests to prevent state leakage between test cases.
 */
export function __resetL1ForTests(): void {
  l1Cache.clear();
}

/**
 * Diagnostic: count L1 entries. Used by /health and tests.
 */
export function __l1SizeForTests(): number {
  return l1Cache.size;
}
