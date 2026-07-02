// In-memory fallback tracker for fail-safe mode when Redis is unavailable
// Uses a simple sliding window counter per key to limit abuse

export const FALLBACK_BURST_LIMIT = 5;
const FALLBACK_WINDOW_MS = 60000; // 1 minute window

const MAX_FALLBACK_ENTRIES = 10000;

interface FallbackEntry {
  count: number;
  windowStart: number;
}

const fallbackCounters = new Map<string, FallbackEntry>();
const FALLBACK_COUNTER_CLEANUP_INTERVAL_MS = 300000; // 5 minutes
let lastFallbackCleanup = Date.now();

export function cleanupFallbackCounters() {
  const now = Date.now();
  if (now - lastFallbackCleanup < FALLBACK_COUNTER_CLEANUP_INTERVAL_MS) return;
  lastFallbackCleanup = now;
  const expiredKeys = [...fallbackCounters.keys()].filter((key) => {
    const entry = fallbackCounters.get(key)!;
    return now - entry.windowStart > FALLBACK_WINDOW_MS * 2;
  });
  for (const key of expiredKeys) {
    fallbackCounters.delete(key);
  }
}

export function checkFallbackLimit(key: string): { allowed: boolean; remaining: number; resetMs: number } {
  cleanupFallbackCounters();

  const now = Date.now();

  if (fallbackCounters.size >= MAX_FALLBACK_ENTRIES) {
    const oldestKey = fallbackCounters.keys().next().value;
    if (oldestKey) {
      fallbackCounters.delete(oldestKey);
    }
  }

  let entry = fallbackCounters.get(key);

  if (!entry || now - entry.windowStart > FALLBACK_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    fallbackCounters.set(key, entry);
  }

  if (entry.count >= FALLBACK_BURST_LIMIT) {
    const resetMs = FALLBACK_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, remaining: 0, resetMs: Math.max(resetMs, 0) };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: FALLBACK_BURST_LIMIT - entry.count,
    resetMs: FALLBACK_WINDOW_MS - (now - entry.windowStart),
  };
}
