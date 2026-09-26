import type { Context, Next } from "hono";
import type { OmaEnv } from "../../types.js";
import { getRedisClient, isRedisReady } from "../../lib/redis-client.js";
import { TOKEN_BUCKET_SCRIPT } from "./lua-scripts.js";
import { checkFallbackLimit, FALLBACK_BURST_LIMIT } from "./memory-store.js";
import { checkRpmLimit } from "./sliding-window.js";
import { logger } from "../../lib/logger.js";
import {
		getModelLimits,
		getRateLimitKey,
		extractClientIp,
		type RateLimitResult,
		type RedisEvalResult,
} from "./utils.js";

export interface TokenBucketConfig {
		bucketSize: number;
		refillRate: number; // tokens per second
}

const DEFAULT_BUCKET_SIZE_USER = 60;
const DEFAULT_TOKENS_PER_SECOND_USER = 20;

// Token bucket rate limiter
export async function checkTokenBucket(
		redis: NonNullable<Awaited<ReturnType<typeof getRedisClient>>>,
		key: string,
		config: TokenBucketConfig,
		requested: number = 1
): Promise<RateLimitResult> {
		try {
				// @upstash/redis signature: eval(script, keys[], args[]).
				// This client is @upstash/redis (see lib/redis-client.ts), NOT
				// node-redis, so the node-redis v4 object form
				// eval(script, { keys, arguments }) does NOT apply here.
				const result = (await redis.eval(TOKEN_BUCKET_SCRIPT, [key], [
						String(config.bucketSize),
						String(config.refillRate),
						String(requested),
				])) as RedisEvalResult;
				return {
						allowed: result[0] === 1,
						remaining: Math.floor(result[1]),
						resetMs: result[2],
						limit: config.bucketSize
				};
		} catch (err) {
				logger.error({ err }, "Token bucket script error");
				// Fail open if Redis is down
				return {
						allowed: true,
						remaining: config.bucketSize,
						resetMs: 0,
						limit: config.bucketSize
				};
		}
}

// Middleware options
export interface TokenBucketOptions {
		bucketSize?: number;
		refillRate?: number;
		keyPrefix?: string;
		checkRpm?: boolean;
		rpmLimit?: number;
}

// Main rate limit middleware factory (Token Bucket + Optional sliding window RPM check)
export function tokenBucket(options: TokenBucketOptions = {}) {
		const {
				keyPrefix = "tb",
				checkRpm = true,
				rpmLimit = 60
		} = options;

		return async (c: Context<OmaEnv>, next: Next) => {
				const rateLimitKey = getRateLimitKey(c, keyPrefix);

				const redis = await getRedisClient();
				const ready = isRedisReady();

				// Fail-closed: Reject requests when Redis is unavailable (inference routes)
				if (!redis || !ready) {
						logger.error("Redis unavailable -- failing CLOSED for inference route (rate limiting required)");
						const fallback = checkFallbackLimit(rateLimitKey);
						
						const resetTime = Math.ceil((Date.now() + fallback.resetMs) / 1000);
						c.header("X-RateLimit-Limit", String(FALLBACK_BURST_LIMIT));
						c.header("X-RateLimit-Remaining", String(fallback.remaining));
						c.header("X-RateLimit-Reset", String(resetTime));
						c.header("X-RateLimit-Policy", "limiter");
						c.header("Retry-After", String(Math.ceil(fallback.resetMs / 1000)));
						
						if (!fallback.allowed) {
								return c.json(
										{ error: { message: "Rate limit temporarily unavailable. Please try again later.", type: "rate_limit_error", code: "rate_limit_unavailable" } },
										503
								);
						}
						
						c.set("rateLimit", { remaining: fallback.remaining, reset: resetTime });
						await next();
						return;
				}

				try {
						const bucketConfig: TokenBucketConfig = {
								bucketSize: options.bucketSize ?? DEFAULT_BUCKET_SIZE_USER,
								refillRate: options.refillRate ?? DEFAULT_TOKENS_PER_SECOND_USER
						};

						const tbResult = await checkTokenBucket(redis, rateLimitKey, bucketConfig);

						const limit = Math.max(tbResult.limit, rpmLimit);
						const remaining = Math.floor(tbResult.remaining);
						const resetTime = Math.ceil((Date.now() + tbResult.resetMs) / 1000);

						c.header("X-RateLimit-Limit", String(limit));
						c.header("X-RateLimit-Remaining", String(Math.max(remaining, 0)));
						c.header("X-RateLimit-Reset", String(resetTime));
						c.header("X-RateLimit-Policy", "limiter");

						if (checkRpm) {
								const rpmKey = `${rateLimitKey}:rpm`;
								const rpmResult = await checkRpmLimit(redis, rpmKey, rpmLimit);

								if (!rpmResult.allowed) {
										const retryAfter = Math.max(Math.ceil(rpmResult.resetMs / 1000), 1);
										c.header("X-RateLimit-Remaining", "0");
										c.header("X-RateLimit-Reset", String(Math.ceil((Date.now() + retryAfter * 1000) / 1000)));
										c.header("Retry-After", String(retryAfter));
										return c.json(
												{
														error: {
																message: "Rate limit exceeded. Please try again later.",
																type: "rate_limit_error",
																code: "rate_limit_exceeded",
																retryAfter
														}
												},
												429
										);
								}

								if (rpmResult.remaining < remaining) {
										c.header("X-RateLimit-Remaining", String(rpmResult.remaining));
								}
						}

						if (!tbResult.allowed) {
								const retryAfter = Math.max(Math.ceil(tbResult.resetMs / 1000), 1);
								c.header("X-RateLimit-Remaining", "0");
								c.header("Retry-After", String(retryAfter));
								return c.json(
										{
												error: {
														message: "Rate limit exceeded. Please try again later.",
														type: "rate_limit_error",
														code: "rate_limit_exceeded",
														retryAfter
												}
										},
										429
								);
						}

						c.set("rateLimit", {
								remaining,
								reset: resetTime
						});

						await next();
				} catch (err) {
						logger.error({ err }, "CRITICAL: Rate limit check failed -- failing CLOSED");
						c.header("X-RateLimit-Policy", "limiter");
						return c.json(
								{ error: { message: "Rate limiting temporarily unavailable", type: "rate_limit_error", code: "rate_limit_unavailable" } },
								503
						);
				}
		};
}

export function modelRateLimit(options: TokenBucketOptions = {}) {
		const baseRateLimit = tokenBucket(options);

		return async (c: Context<OmaEnv>, next: Next) => {
				let model: string | undefined;
				if (c.req.method !== "GET" && c.req.method !== "HEAD") {
						try {
								model = (await c.req.json<{ model?: string }>())?.model;
						} catch {
								// Ignored
						}
				}

				if (!model) {
						await next();
						return;
				}

				const apiKey = c.get("apiKey");
				const modelLimits = getModelLimits(model);

				if (!modelLimits) {
						await baseRateLimit(c, next);
						return;
				}

				const redis = await getRedisClient();
				const ready = isRedisReady();

				if (!redis || !ready) {
						logger.error("Redis unavailable -- failing CLOSED for model rate limiting");
						const fallback = checkFallbackLimit(getRateLimitKey(c, `tb:model:${model}`));
						
						const resetTime = Math.ceil((Date.now() + fallback.resetMs) / 1000);
						c.header("X-RateLimit-Limit", String(FALLBACK_BURST_LIMIT));
						c.header("X-RateLimit-Remaining", String(fallback.remaining));
						c.header("X-RateLimit-Reset", String(resetTime));
						c.header("X-RateLimit-Policy", "limiter");
						c.header("Retry-After", String(Math.ceil(fallback.resetMs / 1000)));
						
						if (!fallback.allowed) {
								return c.json(
										{ error: { message: `Rate limit temporarily unavailable for model '${model}'. Please try again later.`, type: "rate_limit_error", code: "rate_limit_unavailable" } },
										503
								);
						}
						
						await next();
						return;
				}

				try {
							let rateLimitKey: string;
							if (apiKey) {
									rateLimitKey = `tb:model:${apiKey.id}:${model}`;
							} else {
											// SECURITY (C-2): Use extractClientIp() which validates trusted
											// proxy IPs before reading x-forwarded-for. Direct header reads
											// allowed spoofed XFF bypass of per-IP rate limits.
											const ip = extractClientIp(c);
											rateLimitKey = `tb:model:ip:${ip}:${model}`;
							}

						const rpmKey = `${rateLimitKey}:rpm`;
						const rpmResult = await checkRpmLimit(redis, rpmKey, modelLimits.rpm, 60);

						const resetTime = Math.ceil((Date.now() + rpmResult.resetMs) / 1000);

						c.header("X-RateLimit-Limit", String(modelLimits.rpm));
						c.header("X-RateLimit-Remaining", String(rpmResult.remaining));
						c.header("X-RateLimit-Reset", String(resetTime));
						c.header("X-RateLimit-Policy", `model-rpm:${modelLimits.rpm}/min`);

						if (!rpmResult.allowed) {
								const retryAfter = Math.max(Math.ceil(rpmResult.resetMs / 1000), 1);
								c.header("Retry-After", String(retryAfter));
								return c.json(
										{
												error: {
														message: `Rate limit exceeded for model '${model}'. Please try again later.`,
														type: "rate_limit_error",
														code: "rate_limit_exceeded",
														retryAfter
												}
										},
										429
								);
						}

						await next();
				} catch (err) {
						logger.error({ err }, "CRITICAL: Model rate limit check failed -- failing CLOSED");
						c.header("X-RateLimit-Policy", "limiter");
						return c.json(
								{ error: { message: "Rate limiting temporarily unavailable", type: "rate_limit_error", code: "rate_limit_unavailable" } },
								503
						);
				}
		};
}


