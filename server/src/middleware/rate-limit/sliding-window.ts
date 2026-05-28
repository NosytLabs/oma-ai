import type { Context, Next } from "hono";
import { getRedisClient, isRedisReady } from "../../lib/redis-client.js";
import { RPM_LIMIT_SCRIPT } from "./lua-scripts.js";
import { getRightmostIp, type RateLimitResult, type RedisEvalResult } from "./utils.js";
import { logger } from "../../lib/logger.js";

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
    const result = await (redis.eval as (script: string, count: number, key: string, ...args: number[]) => Promise<unknown>)(
      RPM_LIMIT_SCRIPT,
      1,
      key,
      limit,
      windowMs,
      requested
    ) as RedisEvalResult;
    return {
      allowed: result[0] === 1,
      remaining: Math.max(0, limit - result[1]),
      resetMs: result[2],
      limit
    };
  } catch (err) {
    logger.error({ err }, "RPM limit script error");
    throw err;
  }
}

// Traditional fixed-window Rate Limiter (Fail-closed for security/auth routes)
export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyPrefix = "rl" } = options;
  const windowSec = Math.ceil(windowMs / 1000);

  return async (c: Context, next: Next) => {
    const apiKeyId = c.get("apiKeyId") as string | undefined;

    let rateLimitKey: string;
    if (apiKeyId) {
      rateLimitKey = `${keyPrefix}:key:${apiKeyId}`;
    } else {
      const ip = getRightmostIp(c.req.header("x-forwarded-for"))
        || c.req.header("x-real-ip")
        || "unknown";
      rateLimitKey = `${keyPrefix}:ip:${ip}`;
    }

    const redis = await getRedisClient();
    const ready = isRedisReady();

    // Fail-closed: Reject requests when Redis is unavailable (auth routes)
    // Security-critical: protecting auth endpoints requires strict rate limiting
    if (!redis || !ready) {
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
      logger.error({ err }, "Redis operation failed -- failing CLOSED for auth route");
      // Fail closed on error for auth routes
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
