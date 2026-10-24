import apiLimits from "../../inference/api-limits.json" with { type: "json" };
// In-memory fallback tracker for fail-safe mode when Redis is unavailable.
// A bounded per-process counter: enforcement degrades, availability does not.

export const FALLBACK_BURST_LIMIT = apiLimits.emergencyRequestsPerMinute;
const FALLBACK_WINDOW_MS = 60000; // 1 minute window

const MAX_FALLBACK_ENTRIES = 10000;

interface FallbackEntry {
	count: number;
	windowStart: number;
	windowMs: number;
}

const fallbackCounters = new Map<string, FallbackEntry>();
const FALLBACK_COUNTER_CLEANUP_INTERVAL_MS = 300000; // 5 minutes
let lastFallbackCleanup = Date.now();

function cleanupFallbackCounters() {
	const now = Date.now();
	if (now - lastFallbackCleanup < FALLBACK_COUNTER_CLEANUP_INTERVAL_MS) return;
	lastFallbackCleanup = now;
	// Entries carry their own window length now (a 24h daily quota lives
	// alongside 60s burst counters), so expiry is computed per entry rather
	// than against a single module-level window constant.
	const expiredKeys = [...fallbackCounters.keys()].filter((key) => {
		const entry = fallbackCounters.get(key)!;
		return now - entry.windowStart > entry.windowMs * 2;
	});
	for (const key of expiredKeys) {
		fallbackCounters.delete(key);
	}
}

/**
 * Count a request or token weight against `key` in a fixed window, returning an honest
 * `remaining`. Used wherever Redis is unavailable but the cap must still be
 * enforced locally — a missing cache dependency should degrade enforcement,
 * not remove it.
 */
export function checkMemoryCounter(
	key: string,
	limit: number,
	windowMs: number,
	requested: number = 1,
): { allowed: boolean; remaining: number; resetMs: number } {
	if (!Number.isSafeInteger(requested) || requested < 1) throw new RangeError("Rate limit weight must be a positive integer");
	cleanupFallbackCounters();

	const now = Date.now();

	if (fallbackCounters.size >= MAX_FALLBACK_ENTRIES) {
		// Evict the LEAST-used counter, not the oldest-inserted one. Insertion
		// order could drop an ACTIVE long-lived counter (a 24h daily quota)
		// whose budget was silently reset to zero mid-window, handing an
		// exhausted caller a fresh allowance. Dropping the counter with the
		// least usage loses the least enforcement.
		let evictKey: string | undefined;
		let evictCount = Number.POSITIVE_INFINITY;
		for (const [candidate, candidateEntry] of fallbackCounters) {
			if (candidateEntry.count < evictCount) {
				evictCount = candidateEntry.count;
				evictKey = candidate;
			}
		}
		if (evictKey) fallbackCounters.delete(evictKey);
	}

	let entry = fallbackCounters.get(key);

	if (!entry || now - entry.windowStart > windowMs) {
		entry = { count: 0, windowStart: now, windowMs };
		fallbackCounters.set(key, entry);
	}

	const resetMs = Math.max(windowMs - (now - entry.windowStart), 0);

	if (entry.count + requested > limit) {
		return { allowed: false, remaining: 0, resetMs };
	}

	entry.count += requested;
	return { allowed: true, remaining: limit - entry.count, resetMs };
}

/** Per-minute abuse guard used by the rate limiter when Redis is down. */
export function checkFallbackLimit(key: string): { allowed: boolean; remaining: number; resetMs: number } {
	return checkMemoryCounter(key, FALLBACK_BURST_LIMIT, FALLBACK_WINDOW_MS);
}
