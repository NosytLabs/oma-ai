import type { Context, Next } from "hono";
import type { OmaEnv } from "../../types.js";
import { getRedisClient, isRedisReady } from "../../lib/redis-client.js";
import { FIXED_WINDOW_SCRIPT, RPM_LIMIT_SCRIPT } from "./lua-scripts.js";
import {
	rateLimitKeyLayers,
	type RateLimitResult,
	type RedisEvalResult,
} from "./utils.js";
import { logger } from "../../lib/logger.js";
import { checkMemoryCounter } from "./memory-store.js";

/** Result of a fixed-window check, including the key's live TTL. */
interface FixedWindowResult {
	allowed: boolean;
	current: number;
	/** Requests still available in this window. */
	remaining: number;
	ttlMs: number;
}

/**
 * Fixed-window request counter.
 *
 * INCR + PEXPIRE + PTTL run inside ONE Lua script (see FIXED_WINDOW_SCRIPT).
 * The previous three-round-trip version could orphan a key without a TTL if
 * the process died between INCR and EXPIRE, which 429'd that client forever.
 */
export async function checkFixedWindow(
	redis: NonNullable<Awaited<ReturnType<typeof getRedisClient>>>,
	key: string,
	maxRequests: number,
	windowMs: number,
): Promise<FixedWindowResult> {
	const result = (await redis.eval(FIXED_WINDOW_SCRIPT, [key], [
		String(windowMs),
		String(maxRequests),
	])) as RedisEvalResult;
	return {
		allowed: result[0] === 1,
		current: result[1],
		remaining: Math.max(0, maxRequests - result[1]),
		ttlMs: Math.max(result[2], 0),
	};
}

// RPM limiter using sliding window
export async function checkRpmLimit(
	redis: NonNullable<Awaited<ReturnType<typeof getRedisClient>>>,
	key: string,
	limit: number,
	windowSec: number = 60,
	requested: number = 1
): Promise<RateLimitResult> {
	const windowMs = windowSec * 1000;

	try {
			// @upstash/redis eval(script, keys, args) — plain arrays.
			const result = (await redis.eval(RPM_LIMIT_SCRIPT, [key], [
				String(limit), String(windowMs), String(requested),
			])) as RedisEvalResult;
			return {
				allowed: result[0] === 1,
				remaining: Math.max(0, limit - result[1]),
				resetMs: result[2],
				limit
			};
		} catch (err) {
			logger.error({ err }, "RPM limit script error");
			// SECURITY/P0: never fail open here. The previous
			// `return { allowed: true }` meant ANY Redis error — a transient
			// timeout, a NOSCRIPT after a script flush, a bad reply shape —
			// silently removed the request cap and reported `remaining: limit`,
			// i.e. the caller was told it had a full budget it was not being
			// charged against. On the inference path that is unbounded
			// spend; on auth paths it is unbounded OTP/SIWE attempts.
			//
			// Degrade to the bounded per-process memory store instead: weaker
			// enforcement (per-instance, not cluster-wide) but still enforced,
			// and `degraded: true` propagates so the caller can label the
			// response honestly.
			const fb = checkMemoryCounter(key, limit, windowMs);
			return {
				allowed: fb.allowed,
				remaining: fb.remaining,
				resetMs: fb.resetMs,
				limit,
				degraded: true,
			};
		}
}

// Traditional fixed-window Rate Limiter (Fail-closed for security/auth routes)
export interface RateLimitOptions {
		windowMs: number;
		maxRequests: number;
		keyPrefix?: string;
		/**
		 * When Redis is unavailable: `false` degrades to a bounded
		 * per-process memory store (still 429s, header `degraded-memory`);
		 * `true` returns 503 instead.
		 *
		 * Defaults to `false`. The previous `true` default meant that any
		 * deployment without working @upstash/redis credentials silently
		 * 503'd every route using the default — in production that took out
		 * POST /api/v1/checkout and POST /x402/verify (both verified 503
		 * rate_limit_error), i.e. the entire revenue path, while the rest of
		 * the API looked healthy. A missing cache dependency should degrade
		 * enforcement, not availability.
		 *
		 * Opt in to `true` only for a route where failing open is worse than
		 * failing closed.
		 */
		failClosed?: boolean;
}

export function rateLimit(options: RateLimitOptions) {
	const { windowMs, maxRequests, keyPrefix = "rl", failClosed = false } = options;
	// Per-limiter-instance, not per-process: each configured route gets its
	// own one-shot warning instead of the first one silencing the rest.
	let degradedWarned = false;

	return async (c: Context, next: Next) => {
		// Per-user AND per-key AND per-IP. See rateLimitKeyLayers(): keying
		// only on apiKeyId let one user mint N keys and multiply the cap N
		// times for a single account.
		const keyLayers = rateLimitKeyLayers(c as unknown as Context<OmaEnv>, keyPrefix);
		// Kept for the degraded paths, which fall back to a single counter.
		const rateLimitKey = keyLayers[0]!;

		const redis = await getRedisClient();
		const ready = isRedisReady();

		if (!redis || !ready) {
			if (!failClosed) {
				// Degrade to a per-process limiter rather than removing the
				// limit. Returning next() here made the cap vanish entirely
				// for the duration of a Redis outage: unbounded magic-link
				// sends, unbounded OTP attempts, unbounded SIWE. Failing
				// closed instead would take login down entirely, which is
				// the availability cost this option exists to avoid.
				//
				// The memory store is per-process, so the bound holds within
				// an instance rather than cluster-wide. That is a weaker
				// guarantee than Redis, and deliberately labelled so in the
				// response header rather than being passed off as a normal
				// rate-limited response.
				if (!degradedWarned) {
					logger.warn(
						{ keyPrefix },
						"Redis unavailable -- rate limiting degraded to per-process memory store",
					);
					degradedWarned = true;
				}
				// Preserve this route's budget. The emergency inference cap
				// of 5/min breaks ordinary auth and session refresh flows.
				const fb = checkMemoryCounter(rateLimitKey, maxRequests, windowMs);
				c.header("X-RateLimit-Policy", "degraded-memory");
				c.header("X-RateLimit-Limit", String(maxRequests));
				c.header("X-RateLimit-Remaining", String(fb.remaining));
				c.header("X-RateLimit-Reset", String(Math.ceil((Date.now() + fb.resetMs) / 1000)));
				if (!fb.allowed) {
					c.header("Retry-After", String(Math.ceil(fb.resetMs / 1000)));
					return c.json(
						{ error: { message: "Rate limit exceeded. Please try again later.", type: "rate_limit_error", code: "rate_limit_exceeded" } },
						429,
					);
				}
				return next();
			}
			logger.error("Redis unavailable -- failing CLOSED for auth route (rate limiting required)");
			c.header("X-RateLimit-Limit", String(maxRequests));
			c.header("X-RateLimit-Remaining", "0");
			c.header("X-RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + 60));
			c.header("X-RateLimit-Policy", "limiter");
			c.header("Retry-After", "60");
			return c.json(
				{ error: { message: "Service temporarily unavailable. Please try again later.", type: "rate_limit_error", code: "service_unavailable" } },
				503
			);
		}

		try {
			// Check EVERY layer before admitting the request. The most
			// constrained layer wins: reporting the per-IP remaining count for
			// a request that was actually rejected by the per-user cap would
			// tell the client it has budget it does not have.
			let tightest: FixedWindowResult | null = null;
			for (const key of keyLayers) {
				const res = await checkFixedWindow(redis, key, maxRequests, windowMs);
				if (!res.allowed) {
					// Still drain the remaining layers: a rejected request must
					// consume budget on every bucket, otherwise an attacker
					// alternates identities and each bucket stays under cap.
					for (const other of keyLayers) {
						if (other === key) continue;
						await checkFixedWindow(redis, other, maxRequests, windowMs);
					}
					tightest = res;
					break;
				}
				if (!tightest || res.remaining < tightest.remaining) tightest = res;
			}

			const current = tightest?.current ?? 1;
			const ttl = Math.ceil((tightest?.ttlMs ?? windowMs) / 1000);
			const resetTime = Math.ceil(Date.now() / 1000) + Math.max(ttl, 0);

			c.header("X-RateLimit-Limit", String(maxRequests));
			c.header("X-RateLimit-Remaining", String(Math.max(maxRequests - current, 0)));
			c.header("X-RateLimit-Reset", String(resetTime));

			if (tightest && !tightest.allowed) {
				c.header("Retry-After", String(Math.max(ttl, 1)));
				return c.json(
					{ error: { message: "Rate limit exceeded. Please try again later.", type: "rate_limit_error", code: "rate_limit_exceeded" } },
					429
				);
			}
		} catch (err) {
			if (!failClosed) {
				// Same reasoning as the unavailable branch above: a Redis
				// error must not silently remove the cap.
				const fb = checkMemoryCounter(rateLimitKey, maxRequests, windowMs);
				c.header("X-RateLimit-Policy", "degraded-memory");
				c.header("X-RateLimit-Limit", String(maxRequests));
				c.header("X-RateLimit-Remaining", String(fb.remaining));
				c.header("X-RateLimit-Reset", String(Math.ceil((Date.now() + fb.resetMs) / 1000)));
				if (!fb.allowed) {
					c.header("Retry-After", String(Math.ceil(fb.resetMs / 1000)));
					return c.json(
						{ error: { message: "Rate limit exceeded. Please try again later.", type: "rate_limit_error", code: "rate_limit_exceeded" } },
						429,
					);
				}
				return next();
			}
			logger.error({ err }, "Redis operation failed -- failing CLOSED for auth route");
			c.header("X-RateLimit-Limit", String(maxRequests));
			c.header("X-RateLimit-Remaining", "0");
			c.header("X-RateLimit-Policy", "limiter");
			c.header("Retry-After", "60");
			return c.json(
				{ error: { message: "Service temporarily unavailable. Please try again later.", type: "rate_limit_error", code: "service_unavailable" } },
				503
			);
		}

		await next();
	};
}
