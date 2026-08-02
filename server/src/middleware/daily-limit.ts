/**
 * Daily usage limits for website chat (free tier).
 * 
 * - Anonymous users (by IP): 20 requests/day on Gonka models
 * - Registered users: 100 requests/day on Gonka models
 * - API calls (without X-OMA-Source: website header): always require credits
 * 
 * This is ONLY for the website chat page. API usage always costs credits.
 */
import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { logger } from "../lib/logger.js";
import { extractClientIp } from "./rate-limit/utils.js";
import { getModelById } from "../inference/models.js";

export const DAILY_LIMIT_ANONYMOUS = 20;
export const DAILY_LIMIT_REGISTERED = 100;

interface DailyUsageResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetMs: number;
}

/**
 * Check daily usage limit for website chat.
 * Key format: daily:{ip|userId}:{date}
 */
export async function checkDailyUsageLimit(
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

    // Check if this is a free Gonka model.
    // Clone the raw request first: `c.req.json()` consumes the body stream,
    // which would leave the route handler reading an empty body.
    const body = await c.req.raw
      .clone()
      .json()
      .catch(() => null);
    const model = body?.model as string | undefined;

    // Provider-based check (was hardcoded to two non-existent model ids
    // `minimax-m2.7` and `kimi-k2.6`, which made the daily-limit gate
    // a no-op against the live catalog). gonka-routed models are the
    // free tier on /chat.
    const def = model ? getModelById(model) : null;
    const isGonkaModel = !!def && def.provider === "gonka";
    if (!isGonkaModel) {
      return next();
    }

    // Determine identifier and limit
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
