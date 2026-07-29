import { NONCE_REDIS_TTL_SECONDS } from "../constants.js";
import { logger } from "../lib/logger.js";
import { getRedisClient } from "../lib/redis-client.js";

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

// CRIT-2 (x402 nonce/replay). Atomic consume via Redis SET NX EX.
// Returns true if the nonce is fresh (first time seen), false if already
// consumed (replay). The TTL is short (10 min) — nonces are single-use
// receipts that should not persist beyond the payment window.
// Falls back to in-memory LRU-bounded Map when Redis is unavailable.
export async function consumeNonce(nonce: string | undefined): Promise<{ ok: boolean; reason?: string }> {
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
