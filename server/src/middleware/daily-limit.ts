/**
	* Daily usage limits for website chat (free tier).
	*
 * - Anonymous users (by IP): 20 requests/day on OMA-AI models
* - Registered users (by userId): 100 requests/day on OMA-AI models
* - Session users on the website free models ride free (no per-request
*   charge) UP TO the daily cap; API-key callers always pay via the
*   standard billing path, even on the same models.
* - API calls (without X-OMA-Source: website header): always require credits
	*
	* This is ONLY for the website chat page. API usage always costs credits.
	*
	* No balance bypass: everyone shares the same small daily free quota.
	* Funded users who exhaust it switch to paid API usage (unlimited).
	* A bypass would let a $1 deposit unlock unlimited free inference.
	*/
import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { logger } from "../lib/logger.js";
import { extractClientIp } from "./rate-limit/utils.js";
import { checkMemoryCounter } from "./rate-limit/memory-store.js";
import { getModelById } from "../inference/models.js";
import { isFreeWebsiteModel } from "../inference/free-website-model.js";

/** Shared with routes/daily-usage.ts so the enforced cap and the
	displayed quota can never drift apart. */
export const DAILY_LIMIT_ANONYMOUS = 20;
export const DAILY_LIMIT_REGISTERED = 100;

interface DailyUsageResult {
	available: boolean;
	allowed: boolean;
		remaining: number;
		limit: number;
		resetMs: number;
}

/**
	* Check daily usage limit for website chat.
	* Key format: daily:{ip|userId}:{date}
	*/
async function checkDailyUsageLimit(
		identifier: string,
		limit: number
): Promise<DailyUsageResult> {
		const redis = await getRedisClient();
		const ready = isRedisReady();

		// Fail open if Redis is down (availability > strict limits for free tier).
		// A quota-store outage must not brick the free website chat demo.
		//
		// But "fail open" must mean *degrade enforcement*, not *drop* it. This
		// used to return `allowed: true, remaining: 0` unconditionally, which
		// made the anonymous 20/day cap completely unenforced in production
		// (there are no working Upstash credentials there) AND told every caller
		// they had 0 left while happily serving them. Degrade to a bounded
		// per-process counter instead, same policy the rate limiter already uses
		// for its `degraded-memory` mode.
		if (!redis || !ready) {
			logger.warn("Redis unavailable for daily free-tier limit — enforcing a bounded in-memory cap (degraded)");
			const mem = checkMemoryCounter(identifier, limit, 86_400_000);
			return { available: true, allowed: mem.allowed, remaining: mem.remaining, limit, resetMs: mem.resetMs };
		}

		const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
		const key = `daily:${identifier}:${today}`;

		try {
				const current = await redis.incr(key);
				
				// Set expiry on first request of the day (24 hours)
				if (current === 1) {
						await redis.expire(key, 86400);
				}

				const remaining = Math.max(0, limit - current);
				const ttl = await redis.ttl(key);
				const resetMs = ttl > 0 ? ttl * 1000 : 0;

			return {
				available: true,
				allowed: current <= limit,
						remaining,
						limit,
						resetMs,
				};
		} catch (err) {
				logger.error({ err }, "Daily usage limit check failed — allowing request (fail open)");
				return { available: true, allowed: true, remaining: 0, limit, resetMs: 0 };
		}
}

/**
	* Middleware to enforce daily usage limits for website chat.
	* Only applies when X-OMA-Source: website header is present.
	*/
export function dailyUsageLimit() {
		return async (c: Context<OmaEnv>, next: Next) => {
				// Only apply to website chat requests
				const source = c.req.header("X-OMA-Source");
				if (source !== "website") {
						return next();
				}

				// Check if this is a free OMA-AI model.
				// Clone the raw request first: `c.req.json()` consumes the body stream,
				// which would leave the route handler reading an empty body.
				const body = await c.req.raw
						.clone()
						.json()
						.catch(() => null);
				const model = body?.model as string | undefined;

				// Provider-based check: only OMA-AI-routed models that map to the
				// live OpenBroker catalog (see FREE_WEBSITE_MODEL_IDS) qualify as
				// free on /chat. Other free tier labels in the catalog (Venice
				// "Free*" chips) are marketing-only — they do NOT pass the
				// anonymous-website-chat gate here.
				const isCatalogModel = model ? !!getModelById(model) : false;
				if (!isCatalogModel || !model || !isFreeWebsiteModel(model)) {
						return next();
				}

				// Determine identifier and limit. No balance bypass — funded
				// accounts share the same free quota; beyond it they use the
				// paid API (which always bills, even on free-tier models).
				const userId = c.get("userId");

				let identifier: string;
				let limit: number;

				if (userId) {
						identifier = `user:${userId}`;
						limit = DAILY_LIMIT_REGISTERED;
				} else {
						const ip = extractClientIp(c);
						identifier = `ip:${ip}`;
						limit = DAILY_LIMIT_ANONYMOUS;
				}

				const result = await checkDailyUsageLimit(identifier, limit);
				if (!result.available) {
					return c.json(
						{
							error: {
								message: "Free website chat is temporarily unavailable. Please try again shortly.",
								type: "service_unavailable",
								code: "free_tier_unavailable",
							},
						},
						503,
					);
				}

				if (!result.allowed) {
						const retryAfterHours = Math.ceil(result.resetMs / 3600000);
						return c.json(
								{
										error: {
												message: `Daily free limit reached (${limit} requests/day). ${
														userId
																? "Upgrade for unlimited API access."
																: "Sign in for 100 requests/day, or upgrade for unlimited API access."
												} Resets in ~${retryAfterHours}h.`,
												type: "rate_limit_exceeded",
												code: "daily_limit_exceeded",
												limit: result.limit,
												remaining: 0,
												reset_ms: result.resetMs,
										},
								},
								429
						);
				}

				// Add rate limit headers
				c.header("X-DailyLimit-Limit", String(result.limit));
				c.header("X-DailyLimit-Remaining", String(result.remaining));
				if (result.resetMs > 0) {
						c.header("X-DailyLimit-Reset", String(Math.ceil(result.resetMs / 1000)));
				}

				return next();
		};
}
