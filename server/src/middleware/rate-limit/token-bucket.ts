import type { Context, Next } from "hono";
import type { OmaEnv } from "../../types.js";
import { getRedisClient, isRedisReady } from "../../lib/redis-client.js";
import { getApiKeyRateLimits } from "../../lib/rate-limit-config.js";
import { TOKEN_BUCKET_SCRIPT } from "./lua-scripts.js";
import { checkFallbackLimit, FALLBACK_BURST_LIMIT } from "./memory-store.js";
import { checkRpmLimit } from "./sliding-window.js";
import { logger } from "../../lib/logger.js";
import {
  getModelLimits,
  getRateLimitKey,
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
    const result = await (redis.eval as (script: string, count: number, key: string, ...args: number[]) => Promise<unknown>)(
      TOKEN_BUCKET_SCRIPT,
      1,
      key,
      config.bucketSize,
      config.refillRate,
      requested
    ) as RedisEvalResult;
    return {
      allowed: result[0] === 1,
      remaining: Math.floor(result[1]),
      resetMs: result[2],
      limit: config.bucketSize
    };
  } catch (err) {
    logger.error({ err }, "Token bucket script error");
    throw err;
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
      c.header("X-RateLimit-Policy", "fail-closed-conservative");
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
      c.header("X-RateLimit-Policy", "token-bucket");

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
      c.header("X-RateLimit-Policy", "fail-closed-error");
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
      c.header("X-RateLimit-Policy", "fail-closed-conservative");
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
          // Use x-real-ip (set by reverse proxy, can't be spoofed by client)
          // or first entry in x-forwarded-for (client IP as seen by proxy)
          const ip = c.req.header('x-real-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
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
      c.header("X-RateLimit-Policy", "fail-closed-error");
      return c.json(
        { error: { message: "Rate limiting temporarily unavailable", type: "rate_limit_error", code: "rate_limit_unavailable" } },
        503
      );
    }
  };
}

export interface SessionRateLimits {
  tpm: number;
  rpm: number;
}

export interface TieredRateLimitConfig {
  global?: {
    tpm: number;
    rpm: number;
  };
  session?: {
    tpm: number;
    rpm: number;
  };
}

const DEFAULT_SESSION_LIMITS: SessionRateLimits = {
  tpm: 120000,
  rpm: 60,
};

const GLOBAL_LIMITS: SessionRateLimits = {
  tpm: 500000,
  rpm: 300,
};

export async function checkSessionRateLimit(
  redis: Awaited<ReturnType<typeof getRedisClient>>,
  keyId: string,
  requestedTokens: number = 0,
  _sessionLimits: SessionRateLimits = DEFAULT_SESSION_LIMITS
): Promise<{ allowed: boolean; reason?: string; globalRemaining?: number; sessionRemaining?: number }> {
  if (!redis) {
    return { allowed: true };
  }

  const keyLimits = getApiKeyRateLimits(keyId);
  const effectiveSessionLimits: SessionRateLimits = {
    tpm: keyLimits.tpm,
    rpm: keyLimits.rpm,
  };

  const globalKey = `ratelimit:global:${keyId}`;
  const sessionKey = `ratelimit:session:${keyId}`;

  try {
    const globalTpmKey = `${globalKey}:tpm`;
    const sessionTpmKey = `${sessionKey}:tpm`;

    const globalTpmResult = await checkTokenBucket(redis, globalTpmKey, {
      bucketSize: GLOBAL_LIMITS.tpm,
      refillRate: GLOBAL_LIMITS.tpm / 60,
    }, requestedTokens);

    if (!globalTpmResult.allowed) {
      return { 
        allowed: false, 
        reason: "global_tpm_exceeded",
        globalRemaining: globalTpmResult.remaining 
      };
    }

    const sessionTpmResult = await checkTokenBucket(redis, sessionTpmKey, {
      bucketSize: effectiveSessionLimits.tpm,
      refillRate: effectiveSessionLimits.tpm / 60,
    }, requestedTokens);

    if (!sessionTpmResult.allowed) {
      return { 
        allowed: false, 
        reason: "session_tpm_exceeded",
        sessionRemaining: sessionTpmResult.remaining 
      };
    }

    return {
      allowed: true,
      globalRemaining: globalTpmResult.remaining,
      sessionRemaining: sessionTpmResult.remaining,
    };
  } catch (err) {
    // Fail-CLOSED on session rate-limit check errors. Session limits
    // protect billing, so allowing traffic when we cannot verify is
    // unsafe. Surface this as a structured reason so the middleware
    // can map it to a 429/503 response.
    logger.warn({ err }, "Session rate limit check failed -- failing CLOSED");
    return { allowed: false, reason: "session_rate_limit_error" };
  }
}

export async function getSessionRateLimitStatus(
  keyId: string
): Promise<{
  global: { remaining: number; resetMs: number } | null;
  session: { remaining: number; resetMs: number } | null;
} | null> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return null;

  try {
    const globalKey = `ratelimit:global:${keyId}`;
    const sessionKey = `ratelimit:session:${keyId}`;

    const globalTpmKey = `${globalKey}:tpm`;
    const sessionTpmKey = `${sessionKey}:tpm`;

    const [globalResult, sessionResult] = await Promise.all([
      checkTokenBucket(redis, globalTpmKey, {
        bucketSize: GLOBAL_LIMITS.tpm,
        refillRate: GLOBAL_LIMITS.tpm / 60,
      }),
      checkTokenBucket(redis, sessionTpmKey, {
        bucketSize: DEFAULT_SESSION_LIMITS.tpm,
        refillRate: DEFAULT_SESSION_LIMITS.tpm / 60,
      }),
    ]);

    return {
      global: { remaining: globalResult.remaining, resetMs: globalResult.resetMs },
      session: { remaining: sessionResult.remaining, resetMs: sessionResult.resetMs },
    };
  } catch {
    return null;
  }
}

export function createSessionRateLimitMiddleware(options: {
  sessionTpm?: number;
  sessionRpm?: number;
  globalTpm?: number;
  globalRpm?: number;
} = {}) {
  const sessionLimits: SessionRateLimits = {
    tpm: options.sessionTpm ?? DEFAULT_SESSION_LIMITS.tpm,
    rpm: options.sessionRpm ?? DEFAULT_SESSION_LIMITS.rpm,
  };

  return async (c: Context<OmaEnv>, next: Next) => {
    const apiKey = c.get("apiKey");
    
    if (!apiKey) {
      await next();
      return;
    }

    const redis = await getRedisClient();
    const ready = isRedisReady();

    if (!redis || !ready) {
      await next();
      return;
    }

    try {
      const result = await checkSessionRateLimit(redis, apiKey.id, 0, sessionLimits);

      if (!result.allowed) {
        c.header("X-RateLimit-Limit", String(sessionLimits.tpm));
        c.header("X-RateLimit-Remaining", "0");
        c.header("X-RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + 60));
        c.header("X-RateLimit-Scope", result.reason ?? "session");
        c.header("Retry-After", "60");
        return c.json(
          {
            error: {
              message: "Session rate limit exceeded. Please try again later.",
              type: "rate_limit_error",
              code: result.reason ?? "rate_limit_exceeded",
            }
          },
          429
        );
      }

      c.header("X-RateLimit-Scope", "session");
      if (result.sessionRemaining !== undefined) {
        c.header("X-RateLimit-Remaining", String(Math.max(0, result.sessionRemaining)));
      }
    } catch (err) {
      logger.warn({ err }, "Session rate limit middleware check failed");
    }

    await next();
  };
}

export function burstRateLimit(options: TokenBucketOptions = {}) {
  return tokenBucket({
    ...options,
    bucketSize: options.bucketSize ?? 100,
    refillRate: options.refillRate ?? 20,
    rpmLimit: options.rpmLimit ?? 120,
    keyPrefix: options.keyPrefix ?? "tb:burst"
  });
}

export function expressiveRateLimit(options: TokenBucketOptions = {}) {
  return tokenBucket({
    ...options,
    bucketSize: options.bucketSize ?? 200,
    refillRate: options.refillRate ?? 50,
    rpmLimit: options.rpmLimit ?? 300,
    keyPrefix: options.keyPrefix ?? "tb:expressive"
  });
}

export async function getRateLimitStats(_apiKeyId?: string, _userId?: string): Promise<{
  healthy: boolean;
  redisConnected: boolean;
  activeBuckets?: number;
}> {
  const redis = await getRedisClient();
  const ready = isRedisReady();
  const healthy = ready && redis !== null;

  return {
    healthy,
    redisConnected: healthy
  };
}
