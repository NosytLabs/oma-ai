/**
 * RATE LIMIT FAIL-OPEN vs FAIL-CLOSED DESIGN:
 * =============================================
 *
 * `rateLimit()` and `tokenBucket()` (used for inference/auth routes):
 *   -> FAILS CLOSED (returns 503 when Redis is down)
 *   Rationale: Security > availability. Auth and inference endpoints must
 *   not allow unlimited requests when rate limiting infrastructure fails.
 *
 * `checkSessionRateLimit()` and `createSessionRateLimitMiddleware()`:
 *   -> FAILS OPEN (allows requests when Redis is down)
 *   Rationale: Availability > security. Session-level TPM/RPM limits are
 *   operational safeguards, not security controls. Better to serve traffic
 *   without limits than to block all traffic during a Redis outage.
 *
 * This is intentional. Do not change without explicit architectural review.
 */

import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { getApiKeyRateLimits } from "../lib/rate-limit-config.js";

const DEFAULT_BUCKET_SIZE_USER = 60;
const DEFAULT_TOKENS_PER_SECOND_USER = 20;

// Model-specific limits (requests per minute)
export const MODEL_LIMITS: Record<string, { rpm: number; tpm: number }> = {
  // Frontier/reasoning models - strict
  "claude-opus-4-7": { rpm: 30, tpm: 60000 },
  "gpt-5.5": { rpm: 30, tpm: 60000 },
  "o3": { rpm: 30, tpm: 60000 },
  "chainscout-guard-v1": { rpm: 30, tpm: 60000 },
  // Premium/standard models - moderate
  "deepseek-r1": { rpm: 60, tpm: 120000 },
  "deepseek-v3": { rpm: 60, tpm: 120000 },
  "claude-sonnet-4-6": { rpm: 60, tpm: 120000 },
  "claude-haiku-4-5": { rpm: 60, tpm: 120000 },
  "gpt-4o": { rpm: 60, tpm: 120000 },
  "gemini-3.5-flash": { rpm: 60, tpm: 120000 },
  "mistral-large": { rpm: 60, tpm: 120000 },
  "llama-3.3-70b": { rpm: 60, tpm: 120000 },
  "deepseek-v4-pro": { rpm: 60, tpm: 120000 },
  "qwen3-235b": { rpm: 60, tpm: 120000 },
  "qwen3-coder-480b": { rpm: 60, tpm: 120000 },
  "qwen3-72b": { rpm: 60, tpm: 120000 },
  "kimi-k2-5": { rpm: 60, tpm: 120000 },
  "command-r-plus": { rpm: 60, tpm: 120000 },
  "token-take-agent": { rpm: 60, tpm: 120000 },
  // Fast/budget models - higher limits
  "phi-4-mini": { rpm: 120, tpm: 240000 },
  "deepseek-v4-flash": { rpm: 120, tpm: 240000 },
  "phi-4": { rpm: 120, tpm: 240000 },
  "gemini-2.5-flash": { rpm: 120, tpm: 240000 },
  "grok-41-fast": { rpm: 120, tpm: 240000 },
  "gpt-4o-mini": { rpm: 120, tpm: 240000 },
  "qwen3-32b": { rpm: 120, tpm: 240000 },
  "qwen3-8b": { rpm: 120, tpm: 240000 },
  "deepseek-r1-8b": { rpm: 120, tpm: 240000 },
  "mistral-small-3.2": { rpm: 120, tpm: 240000 },
  "llama-3.1-8b": { rpm: 120, tpm: 240000 },
  "gemma-3-27b": { rpm: 120, tpm: 240000 },
  "gemma4-31b": { rpm: 120, tpm: 240000 },
  "qwen3-coder-30b": { rpm: 120, tpm: 240000 },
  "kimi-k2-6": { rpm: 120, tpm: 240000 },
  "glm-5.1": { rpm: 120, tpm: 240000 },
};

// Helper to get client IP from proxy headers safely
function getRightmostIp(xForwardedFor: string | undefined): string {
  if (!xForwardedFor) return "unknown";
  const ips = xForwardedFor.split(",").map((s) => s.trim()).filter(Boolean);
  return ips.length > 0 ? ips[ips.length - 1] : "unknown";
}

// Lua script for atomic token bucket operations
// Returns: [allowed (0/1), remaining_tokens, ms_until_full]
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local bucket_size = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2]) -- tokens per second
local requested = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
  -- Initialize bucket with full tokens
  tokens = bucket_size
  last_refill = now
end

-- Calculate tokens to add based on elapsed time
local elapsed = (now - last_refill) / 1000
local new_tokens = elapsed * refill_rate
tokens = math.min(bucket_size, tokens + new_tokens)

-- Update last refill time
last_refill = now

-- Try to consume tokens
if tokens >= requested then
  tokens = tokens - requested
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
  redis.call('EXPIRE', key, 3600)
  return {1, tokens, 0}
else
  -- Calculate time until enough tokens are available
  local tokens_needed = requested - tokens
  local ms_until_full = math.ceil((tokens_needed / refill_rate) * 1000)
  redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
  redis.call('EXPIRE', key, 3600)
  return {0, tokens, ms_until_full}
end
`;

// Lua script for checking RPM limits (sliding window counter)
// Returns: [allowed (0/1), current_count, seconds_until_reset]
const RPM_LIMIT_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2]) -- window in seconds
local requested = tonumber(ARGV[3])
local now = tonumber(ARGV[4])

-- Remove old entries outside the window
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Count current requests in window
local count = redis.call('ZCARD', key)

if count + requested <= limit then
  -- Add new requests with timestamps as scores
  for i = 1, requested do
    redis.call('ZADD', key, now, now + i)
  end
  redis.call('EXPIRE', key, window + 1)
  return {1, count + requested, 0}
else
  -- Calculate oldest request timestamp
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset_time = 0
  if #oldest > 0 then
    reset_time = math.ceil(oldest[2] + window - now)
  end
  return {0, count, reset_time}
end
`;

interface TokenBucketConfig {
  bucketSize: number;
  refillRate: number; // tokens per second
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
}

// Get model-based rate limits
function getModelLimits(model: string): { rpm: number; tpm: number } | null {
  return MODEL_LIMITS[model.toLowerCase()] ?? null;
}

// Type wrapper for Redis eval results
type RedisEvalResult = [number, number, number];

// Token bucket rate limiter
export async function checkTokenBucket(
  redis: NonNullable<Awaited<ReturnType<typeof getRedisClient>>>,
  key: string,
  config: TokenBucketConfig,
  requested: number = 1
): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const result = await (redis.eval as (script: string, count: number, key: string, ...args: number[]) => Promise<unknown>)(
      TOKEN_BUCKET_SCRIPT,
      1,
      key,
      config.bucketSize,
      config.refillRate,
      requested,
      now
    ) as RedisEvalResult;
    return {
      allowed: result[0] === 1,
      remaining: Math.floor(result[1]),
      resetMs: result[2],
      limit: config.bucketSize
    };
  } catch (err) {
    console.error("[rate-limit] Token bucket script error:", err);
    throw err;
  }
}

// RPM limiter using sliding window
export async function checkRpmLimit(
  redis: NonNullable<Awaited<ReturnType<typeof getRedisClient>>>,
  key: string,
  limit: number,
  windowSec: number = 60,
  requested: number = 1
): Promise<RateLimitResult> {
  const now = Date.now() * 1000000; // Convert to nanoseconds for Redis sorted set precision
  const windowNano = windowSec * 1000000000;

  try {
    const result = await (redis.eval as (script: string, count: number, key: string, ...args: number[]) => Promise<unknown>)(
      RPM_LIMIT_SCRIPT,
      1,
      key,
      limit,
      windowNano,
      requested,
      now
    ) as RedisEvalResult;
    return {
      allowed: result[0] === 1,
      remaining: Math.max(0, limit - result[1]),
      resetMs: result[2] / 1000000,
      limit
    };
  } catch (err) {
    console.error("[rate-limit] RPM limit script error:", err);
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

// In-memory fallback tracker for fail-safe mode when Redis is unavailable
// Uses a simple sliding window counter per key to limit abuse
const FALLBACK_BURST_LIMIT = 5;
const FALLBACK_WINDOW_MS = 60000; // 1 minute window

interface FallbackEntry {
  count: number;
  windowStart: number;
}

const fallbackCounters = new Map<string, FallbackEntry>();
const FALLBACK_COUNTER_CLEANUP_INTERVAL_MS = 300000; // 5 minutes
let lastFallbackCleanup = Date.now();

function cleanupFallbackCounters() {
  const now = Date.now();
  if (now - lastFallbackCleanup < FALLBACK_COUNTER_CLEANUP_INTERVAL_MS) return;
  lastFallbackCleanup = now;
  const expiredKeys = [...fallbackCounters.keys()].filter(key => {
    const entry = fallbackCounters.get(key)!;
    return now - entry.windowStart > FALLBACK_WINDOW_MS * 2;
  });
  for (const key of expiredKeys) {
    fallbackCounters.delete(key);
  }
}

function checkFallbackLimit(key: string): { allowed: boolean; remaining: number; resetMs: number } {
  cleanupFallbackCounters();
  
  const now = Date.now();
  let entry = fallbackCounters.get(key);
  
  if (!entry || now - entry.windowStart > FALLBACK_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    fallbackCounters.set(key, entry);
  }
  
  if (entry.count >= FALLBACK_BURST_LIMIT) {
    const resetMs = FALLBACK_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, remaining: 0, resetMs: Math.max(resetMs, 0) };
  }
  
  entry.count++;
  return { allowed: true, remaining: FALLBACK_BURST_LIMIT - entry.count, resetMs: FALLBACK_WINDOW_MS - (now - entry.windowStart) };
}

function getRateLimitKey(c: Context<OmaEnv>, keyPrefix: string): string {
  const apiKey = c.get("apiKey");
  const userId = c.get("userId");
  
  if (apiKey) return `${keyPrefix}:${apiKey.id}`;
  if (userId) return `${keyPrefix}:${userId}`;
  const ip = getRightmostIp(c.req.header("x-forwarded-for"))
    || c.req.header("x-real-ip")
    || "unknown";
  return `${keyPrefix}:ip:${ip}`;
}

// Main rate limit middleware factory (Token Bucket + Optional sliding window RPM check)
// Fail closed if Redis is unavailable (rate limiting required for security)
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
    // Security-critical: allowing unlimited requests when rate limiting fails is unacceptable
    if (!redis || !ready) {
      console.error("[rate-limit] ERROR: Redis unavailable -- failing CLOSED for inference route (rate limiting required)");
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
      // Client limits - use defaults since getClientLimits was dead code
      const bucketConfig: TokenBucketConfig = {
        bucketSize: options.bucketSize ?? DEFAULT_BUCKET_SIZE_USER,
        refillRate: options.refillRate ?? DEFAULT_TOKENS_PER_SECOND_USER
      };

      // Check token bucket
      const tbResult = await checkTokenBucket(redis, rateLimitKey, bucketConfig);

      // Build rate limit headers
      const limit = Math.max(tbResult.limit, rpmLimit);
      const remaining = Math.floor(tbResult.remaining);
      const resetTime = Math.ceil((Date.now() + tbResult.resetMs) / 1000);

      c.header("X-RateLimit-Limit", String(limit));
      c.header("X-RateLimit-Remaining", String(Math.max(remaining, 0)));
      c.header("X-RateLimit-Reset", String(resetTime));
      c.header("X-RateLimit-Policy", "token-bucket");

      // Check RPM limit if enabled
      if (checkRpm) {
        const rpmKey = `${rateLimitKey}:rpm`;
        const effectiveRpmLimit = rpmLimit;
        const rpmResult = await checkRpmLimit(redis, rpmKey, effectiveRpmLimit);

        // Update headers with more restrictive values
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

        // Update remaining if RPM is more restrictive
        if (rpmResult.remaining < remaining) {
          c.header("X-RateLimit-Remaining", String(rpmResult.remaining));
        }
      }

      // Check token bucket result
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

      // Store rate limit info in context for downstream use
      c.set("rateLimit", {
        remaining,
        reset: resetTime
      });

      await next();
    } catch (err) {
      console.error("[rate-limit] CRITICAL: Rate limit check failed -- failing CLOSED:", err);
      c.header("X-RateLimit-Policy", "fail-closed-error");
      return c.json(
        { error: { message: "Rate limiting temporarily unavailable", type: "rate_limit_error", code: "rate_limit_unavailable" } },
        503
      );
    }
  };
}

// Per-model rate limiting middleware
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
      // No specific limits for this model, use base rate limit
      await baseRateLimit(c, next);
      return;
    }

    // Apply model-specific rate limiting
    const redis = await getRedisClient();
    const ready = isRedisReady();

    // Fail-closed: Reject requests when Redis is unavailable (inference routes)
    // Security-critical: allowing unlimited requests when rate limiting fails is unacceptable
    if (!redis || !ready) {
      console.error("[rate-limit] ERROR: Redis unavailable -- failing CLOSED for model rate limiting");
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
        const ip = getRightmostIp(c.req.header("x-forwarded-for"))
          || c.req.header("x-real-ip")
          || "unknown";
        rateLimitKey = `tb:model:ip:${ip}:${model}`;
      }

      // Check RPM for this model
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
      console.error("[rate-limit] CRITICAL: Model rate limit check failed -- failing CLOSED:", err);
      c.header("X-RateLimit-Policy", "fail-closed-error");
      return c.json(
        { error: { message: "Rate limiting temporarily unavailable", type: "rate_limit_error", code: "rate_limit_unavailable" } },
        503
      );
    }
  };
}

// Session-level rate limits (TPM/RPM per session/API key)
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
    console.error("[session-rate-limit] Error:", err);
    return { allowed: true };
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
      console.error("[session-rate-limit] Error:", err);
    }

    await next();
  };
}

// Burst-friendly rate limiter with higher burst capacity
export function burstRateLimit(options: TokenBucketOptions = {}) {
  return tokenBucket({
    ...options,
    bucketSize: options.bucketSize ?? 100,
    refillRate: options.refillRate ?? 20,
    rpmLimit: options.rpmLimit ?? 120,
    keyPrefix: options.keyPrefix ?? "tb:burst"
  });
}

// Expressive rate limiter for heavy usage
export function expressiveRateLimit(options: TokenBucketOptions = {}) {
  return tokenBucket({
    ...options,
    bucketSize: options.bucketSize ?? 200,
    refillRate: options.refillRate ?? 50,
    rpmLimit: options.rpmLimit ?? 300,
    keyPrefix: options.keyPrefix ?? "tb:expressive"
  });
}

// Health check / statistics for rate limiter
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
      console.error("[rate-limit] ERROR: Redis unavailable -- failing CLOSED for auth route (rate limiting required)");
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
      console.error("[rate-limit] ERROR: Redis operation failed -- failing CLOSED for auth route:", err);
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