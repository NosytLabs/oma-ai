/**
	* Daily usage limits for website chat (free tier).
	*
 * - Anonymous users (by IP): 20 requests/day on OMA-AI models
* - Registered users (by userId): 100 requests/day on OMA-AI models
* - Session users on the website free models ride free (no per-request
*   charge) UP TO the daily cap; API-key callers always pay via the
*   standard billing path, even on the same models.
* - Public SDK calls always require credits, regardless of source headers.
	*
	* This is ONLY for the website chat page. API usage always costs credits.
	*
	* No balance bypass: everyone shares the same small daily free quota.
	* Funded users who exhaust it can switch to prepaid API usage.
	* A bypass would let a $1 deposit unlock unlimited free inference.
	*/
import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";
import { extractClientIp } from "./rate-limit/utils.js";
import { getModelById } from "../inference/models.js";
import { isFreeWebsiteModel } from "../inference/free-website-model.js";
import { isWebsiteChatRequest } from "../inference/website-chat-request.js";
import { consumeDailyQuota, DAILY_LIMIT_ANONYMOUS, DAILY_LIMIT_REGISTERED } from "../lib/daily-quota.js";
export { DAILY_LIMIT_ANONYMOUS, DAILY_LIMIT_REGISTERED } from "../lib/daily-quota.js";

/**
	* Middleware to enforce daily usage limits for website chat.
	* Only applies to the authenticated website proxy route.
	*/
export function dailyUsageLimit() {
		return async (c: Context<OmaEnv>, next: Next) => {
				// Only apply to website chat requests
				if (!isWebsiteChatRequest(c)) {
						return next();
				}
				// Explicit API keys use prepaid billing even on website-free models.
				// Their requests must not consume or be blocked by the free quota.
				if (c.get("apiKey")) return next();

				// Check if this is a free OMA-AI model.
				// Hono caches c.req.json() across middleware and the handler. The
				// model limiter has already parsed it; cloning raw here throws
				// "unusable" because that underlying stream has been consumed.
				const body = await c.req.json<{ model?: string }>().catch(() => null);
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

				const result = await consumeDailyQuota(identifier, limit);
				c.header("X-DailyLimit-Policy", result.policy);

				if (!result.allowed) {
						c.header("Retry-After", String(Math.max(1, Math.ceil(result.resetMs / 1000))));
						const retryAfterHours = Math.ceil(result.resetMs / 3600000);
						return c.json(
								{
										error: {
												message: `Daily free limit reached (${limit} requests/day). ${
														userId
																? "Use prepaid API credits for more requests."
																: "Sign in for 100 requests/day, or use prepaid API credits."
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
