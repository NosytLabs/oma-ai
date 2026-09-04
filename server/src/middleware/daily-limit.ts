/**
	* Daily usage limits for website chat (free tier).
	*
	* - Anonymous users (by IP): 20 requests/day on OMA-AI models
	* - Registered users with no paid balance: 100 requests/day on OMA-AI models
	* - Registered users with a positive credit balance: bypassed (pay-as-you-go)
	* - API calls (without X-OMA-Source: website header): always require credits
	*
	* This is ONLY for the website chat page. API usage always costs credits.
	*
	* The bypass for paying users is deliberate: the daily limit exists to
	* prevent abuse of the free tier, not to cap paid usage. Users who have
	* deposited credits pay per request via the standard billing path; layering
	* a daily cap on top would force paying customers to wait until midnight
	* for no economic reason.
	*/
import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";
import { db } from "../db/client.js";
import { creditBalances } from "../db/schema.js";
import { sql } from "drizzle-orm";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { logger } from "../lib/logger.js";
import { extractClientIp } from "./rate-limit/utils.js";
import { getModelById } from "../inference/models.js";
import { isFreeWebsiteModel } from "../inference/free-website-model.js";

const DAILY_LIMIT_ANONYMOUS = 20;
const DAILY_LIMIT_REGISTERED = 100;

interface DailyUsageResult {
		allowed: boolean;
		remaining: number;
		limit: number;
		resetMs: number;
}

/**
	* Check whether an authenticated user has a positive paid credit balance.
	* Read-only; returns `false` on DB error so a transient failure doesn't
	* accidentally bypass the free-tier cap (fail-closed is the safer default
	* here — a paying user hitting a daily limit is a small nuisance; an
	* abuser free-riding on a broken DB query is a cost).
	*/
async function hasPaidBalance(userId: string): Promise<boolean> {
	try {
		const [row] = await db
			.select({ balanceCents: creditBalances.balanceCents })
			.from(creditBalances)
			.where(sql`${creditBalances.userId} = ${userId}`)
			.limit(1);
		return Number(row?.balanceCents ?? 0) > 0;
	} catch (err) {
		logger.error({ err, userId }, "paid-balance check failed — applying daily limit");
		return false;
	}
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

		// Fail open if Redis is down (availability > strict limits for free tier)
		if (!redis || !ready) {
				logger.warn("Redis unavailable for daily limit check — allowing request");
				return { allowed: true, remaining: limit, limit, resetMs: 0 };
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
						allowed: current <= limit,
						remaining,
						limit,
						resetMs,
				};
		} catch (err) {
				logger.error({ err }, "Daily usage limit check failed");
				// Fail open on error
				return { allowed: true, remaining: limit, limit, resetMs: 0 };
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

				// Provider-based check (was hardcoded to two non-existent model ids
				// `deepseek-v4-flash-openbroker` and `kimi-k3`, which made the daily-limit gate
				// a no-op against the live catalog). oma-ai-routed models are the
				// free tier on /chat.
				const isCatalogModel = model ? !!getModelById(model) : false;
				if (!isCatalogModel || !model || !isFreeWebsiteModel(model)) {
						return next();
				}

				// Determine identifier and limit
				const userId = c.get("userId");

				// Paying users bypass the free-tier daily cap. The cap exists to
				// prevent abuse of the free tier, not to throttle paid usage —
				// users with a positive balance already pay per request via the
				// standard billing path in recordUsage().
				if (userId && (await hasPaidBalance(userId))) {
						return next();
				}

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
