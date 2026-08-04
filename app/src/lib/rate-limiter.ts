/**
 * In-memory rate limiter for Node.js runtime API routes.
 *
 * Tracks request counts per (IP, route) key inside a sliding window.
 * Expired entries are pruned automatically on every `check()` call
 * and on a background interval so the Map doesn't grow unbounded.
 *
 * NOT suitable for multi-instance / serverless deployments — use Redis
 * or an external rate-limit service there.
 */

export interface RateLimitResult {
	/** Whether the request is allowed */
	allowed: boolean;
	/** How many requests remain in the current window */
	remaining: number;
	/** Unix timestamp (ms) when the current window resets */
	resetAt: number;
}

interface Bucket {
	count: number;
	resetAt: number;
}

export class RateLimiter {
	private store = new Map<string, Bucket>();
	private cleanupTimer: ReturnType<typeof setInterval> | null = null;
	private readonly limit: number;
	private readonly windowMs: number;

	/**
	 * @param limit   Max requests allowed per window
	 * @param windowMs  Window duration in milliseconds
	 */
	constructor(limit: number, windowMs: number) {
		this.limit = limit;
		this.windowMs = windowMs;

		// Prune expired entries every 60 s so idle keys don't linger.
		if (typeof setInterval !== "undefined") {
			this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
			// Allow the Node process to exit even if the timer is still running.
			if (this.cleanupTimer && typeof this.cleanupTimer.unref === "function") {
				this.cleanupTimer.unref();
			}
		}
	}

	/**
	 * Check (and increment) the rate limit for a given IP + route.
	 */
	check(ip: string, route: string): RateLimitResult {
		this.cleanup();

		const key = `${ip}::${route}`;
		const now = Date.now();
		let bucket = this.store.get(key);

		// If no bucket or window has expired, start fresh.
		if (!bucket || now >= bucket.resetAt) {
			bucket = { count: 0, resetAt: now + this.windowMs };
			this.store.set(key, bucket);
		}

		bucket.count++;

		const allowed = bucket.count <= this.limit;
		const remaining = Math.max(0, this.limit - bucket.count);

		return { allowed, remaining, resetAt: bucket.resetAt };
	}

	/** Remove expired entries from the store. */
	private cleanup(): void {
		const now = Date.now();
		for (const [key, bucket] of this.store) {
			if (now >= bucket.resetAt) {
				this.store.delete(key);
			}
		}
	}

	/** Stop the cleanup timer (useful in tests). */
	destroy(): void {
		if (this.cleanupTimer) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
		this.store.clear();
	}
}

// ---------------------------------------------------------------------------
// Pre-configured limiters
// ---------------------------------------------------------------------------

/** Auth routes: 5 requests per 15 minutes */
const _authLimiter = new RateLimiter(5, 15 * 60 * 1000);

/** Generation routes (image + video): 10 requests per 15 minutes */
const _generationLimiter = new RateLimiter(10, 15 * 60 * 1000);

/** General API routes: 100 requests per 15 minutes */
export const generalLimiter = new RateLimiter(100, 15 * 60 * 1000);
