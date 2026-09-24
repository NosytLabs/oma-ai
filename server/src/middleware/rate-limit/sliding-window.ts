import type { Context, Next } from "hono";
import { getRedisClient, isRedisReady } from "../../lib/redis-client.js";
import { RPM_LIMIT_SCRIPT } from "./lua-scripts.js";
import { extractClientIp, type RateLimitResult, type RedisEvalResult } from "./utils.js";
import { logger } from "../../lib/logger.js";
import { checkFallbackLimit } from "./memory-store.js";

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
				return {
						allowed: true,
						remaining: limit,
						resetMs: 0,
						limit
				};
		}
}

// Traditional fixed-window Rate Limiter (Fail-closed for security/auth routes)
export interface RateLimitOptions {
		windowMs: number;
		maxRequests: number;
		keyPrefix?: string;
		/** Session reads should fail-open so a Redis blip doesn't 503 every page. */
		failClosed?: boolean;
}

export function rateLimit(options: RateLimitOptions) {
	const { windowMs, maxRequests, keyPrefix = "rl", failClosed = true } = options;
	const windowSec = Math.ceil(windowMs / 1000);
	// Per-limiter-instance, not per-process: each configured route gets its
	// own one-shot warning instead of the first one silencing the rest.
	let degradedWarned = false;

		return async (c: Context, next: Next) => {
				const apiKeyId = (c.get("apiKeyId") as string | undefined) || (c.get("apiKey") as { id?: string } | undefined)?.id;

				let rateLimitKey: string;
				if (apiKeyId) {
						rateLimitKey = `${keyPrefix}:key:${apiKeyId}`;
				} else {
						const ip = extractClientIp(c);
						rateLimitKey = `${keyPrefix}:ip:${ip}`;
				}

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
							const fb = checkFallbackLimit(rateLimitKey);
							c.header("X-RateLimit-Policy", "degraded-memory");
							c.header("X-RateLimit-Remaining", String(fb.remaining));
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
						c.header("X-RateLimit-Policy", "fail-closed");
						c.header("Retry-After", "60");
						return c.json(
								{ error: { message: "Service temporarily unavailable. Please try again later.", type: "rate_limit_error", code: "service_unavailable" } },
								503
						);
				}

				try {
						const current = await redis.incr(rateLimitKey);
						if (current === 1) {
								await redis.expire(rateLimitKey, windowSec);
						}

						const ttl = await redis.ttl(rateLimitKey);
						const resetTime = Math.ceil(Date.now() / 1000) + Math.max(ttl, 0);

						c.header("X-RateLimit-Limit", String(maxRequests));
						c.header("X-RateLimit-Remaining", String(Math.max(maxRequests - current, 0)));
						c.header("X-RateLimit-Reset", String(resetTime));

						if (current > maxRequests) {
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
						const fb = checkFallbackLimit(rateLimitKey);
						c.header("X-RateLimit-Policy", "degraded-memory");
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
						c.header("X-RateLimit-Policy", "fail-closed-error");
						c.header("Retry-After", "60");
						return c.json(
								{ error: { message: "Service temporarily unavailable. Please try again later.", type: "rate_limit_error", code: "service_unavailable" } },
								503
						);
				}

				await next();
		};
}
