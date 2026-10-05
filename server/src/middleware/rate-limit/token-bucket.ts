import type { Context, Next } from "hono";
import type { OmaEnv } from "../../types.js";
import { getRedisClient, isRedisReady } from "../../lib/redis-client.js";
import { TOKEN_BUCKET_SCRIPT, TPM_LIMIT_SCRIPT } from "./lua-scripts.js";
import { checkFallbackLimit, checkMemoryCounter, FALLBACK_BURST_LIMIT } from "./memory-store.js";
import { checkRpmLimit } from "./sliding-window.js";
import { logger } from "../../lib/logger.js";
import { estimateTokens, flattenMessageContent } from "../../inference/token-utils.js";
import {
	getModelLimits,
	getRateLimitKey,
	extractClientIp,
	isCountableUserId,
	readApiKeyId,
	type RateLimitResult,
	type RedisEvalResult,
} from "./utils.js";

export interface TokenBucketConfig {
	bucketSize: number;
	refillRate: number; // tokens per second
}

const DEFAULT_BUCKET_SIZE_USER = 60;
const DEFAULT_TOKENS_PER_SECOND_USER = 20;

/**
 * Weighted tokens-per-minute check.
 *
 * Counts TOKENS (prompt + requested output), not requests. The request-count
 * buckets cannot express this: a 10k-token prompt and a 1-token ping are one
 * request each, but differ by 4 orders of magnitude in cost.
 *
 * `member` must be unique per request — two requests in the same millisecond
 * must not collapse into one sorted-set entry, or the second one's weight
 * would overwrite the first and TPM would under-count.
 */
export async function checkTpmLimit(
	redis: NonNullable<Awaited<ReturnType<typeof getRedisClient>>>,
	key: string,
	maxTokens: number,
	requestedTokens: number,
	windowSec: number = 60,
): Promise<RateLimitResult> {
	// Nothing to enforce for a zero-token request; skip the round-trip.
	if (requestedTokens <= 0) {
		return {
			allowed: true,
			remaining: maxTokens,
			resetMs: 0,
			limit: maxTokens,
		};
	}

	// A single request that exceeds the whole window budget can never pass, so
	// reject it up front rather than writing it into Redis.
	if (requestedTokens > maxTokens) {
		return {
			allowed: false,
			remaining: 0,
			resetMs: windowSec * 1000,
			limit: maxTokens,
		};
	}

	try {
		const member = `${Date.now().toString(36)}-${crypto.randomUUID()}`;
		const result = (await redis.eval(
			TPM_LIMIT_SCRIPT,
			[`${key}:z`, `${key}:w`],
			[
				String(windowSec * 1000),
				String(maxTokens),
				String(requestedTokens),
				member,
			],
		)) as RedisEvalResult;
		return {
			allowed: result[0] === 1,
			remaining: Math.max(0, maxTokens - result[1]),
			resetMs: result[2],
			limit: maxTokens,
		};
	} catch (err) {
		logger.error({ err }, "TPM limit script error");
		// Never fail open (see checkRpmLimit). The memory store counts
		// requests, not tokens, so it is charged the request as a single unit
		// — weaker than true TPM but still a real bound.
		const fb = checkMemoryCounter(key, Math.max(1, maxTokens), windowSec * 1000);
		return {
			allowed: fb.allowed,
			remaining: fb.remaining,
			resetMs: fb.resetMs,
			limit: maxTokens,
			degraded: true,
		};
	}
}

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
					// SECURITY/P0: never fail open here. The previous
					// `return { allowed: true }` on ANY Redis error silently removed
					// the bucket for the whole duration of the fault, while still
					// reporting a full budget to the caller — unbounded inference spend
					// behind an error log nobody was reading. Degrade to the bounded
					// per-process counter instead and flag it, so enforcement survives
					// at instance scope and the response is labelled honestly.
					const fb = checkMemoryCounter(key, config.bucketSize, 60_000);
					return {
						allowed: fb.allowed,
						remaining: fb.remaining,
						resetMs: fb.resetMs,
						limit: config.bucketSize,
						degraded: true,
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
										// A degraded result means the bound is per-process, not
										// cluster-wide. Say so rather than presenting it as a normally
										// enforced limit.
										c.header(
											"X-RateLimit-Policy",
											tbResult.degraded ? "degraded-memory" : "limiter",
										);

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

export interface ModelRateLimitOptions extends TokenBucketOptions {
	/** Disable the TPM (tokens-per-minute) layer. */
	skipTpm?: boolean;
}

export function modelRateLimit(options: ModelRateLimitOptions = {}) {
	const baseRateLimit = tokenBucket(options);

	return async (c: Context<OmaEnv>, next: Next) => {
		let model: string | undefined;
		let promptTokens = 0;
		let maxTokens = 0;
		if (c.req.method !== "GET" && c.req.method !== "HEAD") {
			try {
				const body = (await c.req.json<{
					model?: string;
					max_tokens?: number;
					messages?: Array<{ content?: unknown }>;
				}>());
				model = body?.model;
				maxTokens = typeof body?.max_tokens === "number" ? body.max_tokens : 0;
				if (Array.isArray(body?.messages)) {
					for (const m of body.messages) {
						promptTokens += estimateTokens(
							flattenMessageContent(
								m?.content as string | unknown[],
						),
						);
					}
				}
			} catch {
				// Ignored
			}
		}

		if (!model) {
			await next();
			return;
		}

		const apiKey = c.get("apiKey");
		const userId = c.get("userId");
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
			// SECURITY: same layered identity as the generic limiter — a
			// per-USER bucket in addition to the per-key one, so minting N API
			// keys cannot buy N model-rate budgets.
			const apiKeyId = readApiKeyId(c);
			const identity = apiKeyId
				? `key:${apiKeyId}`
				: // SECURITY (C-2): Use extractClientIp() which validates trusted
				  // proxy IPs before reading x-forwarded-for. Direct header reads
				  // allowed spoofed XFF bypass of per-IP rate limits.
				  `ip:${extractClientIp(c)}`;
			const identities = new Set<string>([identity]);
			if (isCountableUserId(userId)) identities.add(`user:${userId}`);

			const prefix = (id: string) => `tb:model:${id}:${model}`;
			let degraded = false;

			// ---- Layer 1: requests per minute (every identity) ----
			let tightestRpm: RateLimitResult | null = null;
			for (const id of identities) {
				const res = await checkRpmLimit(
					redis,
					`${prefix(id)}:rpm`,
					modelLimits.rpm,
					60,
				);
				if (res.degraded) degraded = true;
				if (!res.allowed) {
					tightestRpm = res;
					break;
				}
				if (!tightestRpm || res.remaining < tightestRpm.remaining) {
					tightestRpm = res;
				}
			}

			const rpmReset = Math.ceil(
				(Date.now() + (tightestRpm?.resetMs ?? 0)) / 1000,
			);
			c.header("X-RateLimit-Limit", String(modelLimits.rpm));
			c.header(
				"X-RateLimit-Remaining",
				String(tightestRpm?.remaining ?? modelLimits.rpm),
			);
			c.header("X-RateLimit-Reset", String(rpmReset));
			c.header("X-RateLimit-Policy", `model-rpm:${modelLimits.rpm}/min`);

			if (tightestRpm && !tightestRpm.allowed) {
				const retryAfter = Math.max(Math.ceil(tightestRpm.resetMs / 1000), 1);
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

			// ---- Layer 2: tokens per minute ----
			// Consumes promptTokens + max_tokens, i.e. the worst-case token
			// spend for this request. `tpm` was declared in MODEL_LIMITS and
			// enforced by nothing; without this a caller could spend a full
			// minute's budget in one oversized request while the request-count
			// limiter still read 1/60 used.
			if (!options.skipTpm && modelLimits.tpm > 0) {
				const requested = promptTokens + Math.max(0, maxTokens);

				// A single request bigger than the whole minute budget can
				// never be served within the window — reject rather than
				// burning an upstream call on a guaranteed 429.
				if (requested > modelLimits.tpm) {
					c.header("X-RateLimit-Policy", `model-tpm:${modelLimits.tpm}/min`);
					c.header("X-RateLimit-Remaining", "0");
					c.header("X-RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + 60));
					c.header("Retry-After", "60");
					return c.json(
						{
							error: {
								message: `Request of ${requested} tokens exceeds the ${modelLimits.tpm} tokens/minute limit for model '${model}'. Reduce max_tokens or the prompt size.`,
								type: "rate_limit_error",
								code: "rate_limit_exceeded",
								retryAfter: 60
							}
						},
						429
					);
				}

				let tightestTpm: RateLimitResult | null = null;
				for (const id of identities) {
					const res = await checkTpmLimit(
						redis,
						`${prefix(id)}:tpm`,
						modelLimits.tpm,
						requested,
						60,
					);
					if (res.degraded) degraded = true;
					if (!res.allowed) {
						tightestTpm = res;
						break;
					}
					if (!tightestTpm || res.remaining < tightestTpm.remaining) {
						tightestTpm = res;
					}
				}

				if (tightestTpm) {
					c.header("X-RateLimit-Limit", String(modelLimits.tpm));
					c.header("X-RateLimit-Remaining", String(tightestTpm.remaining));
					c.header(
						"X-RateLimit-Reset",
						String(
							Math.ceil((Date.now() + tightestTpm.resetMs) / 1000),
						),
					);
					c.header(
						"X-RateLimit-Policy",
						degraded
							? `model-tpm:${modelLimits.tpm}/min; degraded-memory`
							: `model-tpm:${modelLimits.tpm}/min`,
					);

					if (!tightestTpm.allowed) {
						const retryAfter = Math.max(
							Math.ceil(tightestTpm.resetMs / 1000),
							1,
						);
						c.header("Retry-After", String(retryAfter));
						return c.json(
							{
								error: {
									message: `Token rate limit exceeded for model '${model}'. Please try again later.`,
									type: "rate_limit_error",
									code: "rate_limit_exceeded",
									retryAfter
								}
							},
							429
						);
					}
				}
			} else if (degraded) {
				// RPM layer degraded to memory but there is no TPM layer to
				// carry the label; surface it on the RPM headers we already set.
				c.header(
					"X-RateLimit-Policy",
					`model-rpm:${modelLimits.rpm}/min; degraded-memory`,
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


