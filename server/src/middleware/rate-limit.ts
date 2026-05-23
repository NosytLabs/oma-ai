import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";

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

// Get client-based rate limits
function getClientLimits(apiKey: OmaEnv["Variables"]["apiKey"]) {
  // Default limits
  let bucketSize = DEFAULT_BUCKET_SIZE_USER;
  let refillRate = DEFAULT_TOKENS_PER_SECOND_USER;

  if (apiKey) {
    // API keys get higher limits than unauthenticated requests
    bucketSize = DEFAULT_BUCKET_SIZE_USER;
    refillRate = DEFAULT_TOKENS_PER_SECOND_USER;
  }

  return { bucketSize, refillRate };
}

// Get model-based rate limits
function getModelLimits(model: string): { rpm: number; tpm: number } | null {
  return MODEL_LIMITS[model.toLowerCase()] ?? null;
}

// Token bucket rate limiter
export async function checkTokenBucket(
  redis: Awaited<ReturnType<typeof getRedisClient>>,
  key: string,
  config: TokenBucketConfig,
  requested: number = 1
): Promise<RateLimitResult> {
  const now = Date.now();
  const scriptArgs = [
    config.bucketSize,
    config.refillRate,
    requested,
    now
  ];

  try {
    // @ts-expect-error - Redis eval signature accepts spread args
    const result = await redis.eval(TOKEN_BUCKET_SCRIPT, 1, key, ...scriptArgs) as [number, number, number];
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
  redis: Awaited<ReturnType<typeof getRedisClient>>,
  key: string,
  limit: number,
  windowSec: number = 60,
  requested: number = 1
): Promise<RateLimitResult> {
  const now = Date.now() * 1000000; // Convert to nanoseconds for Redis sorted set precision
  const windowNano = windowSec * 1000000000;

  const scriptArgs = [
    limit,
    windowNano,
    requested,
    now
  ];

  try {
    // @ts-expect-error - Redis eval signature accepts spread args
    const result = await redis.eval(RPM_LIMIT_SCRIPT, 1, key, ...scriptArgs) as [number, number, number];
    return {
      allowed: result[0] === 1,
      remaining: Math.max(0, limit - result[1]),
      resetMs: result[2] * 1000000, // Convert back to ms
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

// Main rate limit middleware factory (Token Bucket + Optional sliding window RPM check)
// Fail open if Redis is unavailable (rate limiting disabled but traffic flows)
export function tokenBucket(options: TokenBucketOptions = {}) {
  const {
    keyPrefix = "tb",
    checkRpm = true,
    rpmLimit = 60
  } = options;

  return async (c: Context<OmaEnv>, next: Next) => {
    const apiKey = c.get("apiKey");
    const userId = c.get("userId");

    // Determine rate limit key
    let rateLimitKey: string;
    if (apiKey) {
      rateLimitKey = `${keyPrefix}:key:${apiKey.id}`;
    } else if (userId) {
      rateLimitKey = `${keyPrefix}:user:${userId}`;
    } else {
      const ip = getRightmostIp(c.req.header("x-forwarded-for"))
        || c.req.header("x-real-ip")
        || "unknown";
      rateLimitKey = `${keyPrefix}:ip:${ip}`;
    }

    const redis = await getRedisClient();
    const ready = isRedisReady();

    // Fail open if Redis is unavailable (rate limiting bypassed but traffic flows)
    if (!redis || !ready) {
      console.warn("[rate-limit] WARNING: Redis unavailable -- failing OPEN (rate limiting bypassed)");
      // Add header indicating rate limiting is not active
      c.header("X-RateLimit-Limit", "unlimited");
      c.header("X-RateLimit-Remaining", "unlimited");
      c.header("X-RateLimit-Policy", "fail-open");
      c.set("rateLimit", { remaining: -1, reset: 0 });
      await next();
      return;
    }

    try {
      // Get client limits
      const clientLimits = getClientLimits(apiKey);
      const bucketConfig: TokenBucketConfig = {
        bucketSize: options.bucketSize ?? clientLimits.bucketSize,
        refillRate: options.refillRate ?? clientLimits.refillRate
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
          c.header("X-RateLimit-Reset", String(Math.ceil(Date.now() / 1000 + retryAfter)));
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
      console.error("[rate-limit] ERROR: Rate limit check failed -- failing OPEN (rate limiting bypassed):", err);
      // Fail open on error - allow traffic through
      c.header("X-RateLimit-Limit", "unlimited");
      c.header("X-RateLimit-Remaining", "unlimited");
      c.header("X-RateLimit-Policy", "fail-open-error");
      c.set("rateLimit", { remaining: -1, reset: 0 });
      await next();
    }
  };
}

// Per-model rate limiting middleware
export function modelRateLimit(options: TokenBucketOptions = {}) {
  const baseRateLimit = tokenBucket(options);

  return async (c: Context<OmaEnv>, next: Next) => {
    const model = (await c.req.json<{ model?: string }>())?.model;

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

    // Fail open if Redis is unavailable
    if (!redis || !ready) {
      console.warn("[rate-limit] WARNING: Redis unavailable -- failing OPEN for model rate limiting");
      c.header("X-RateLimit-Limit", "unlimited");
      c.header("X-RateLimit-Remaining", "unlimited");
      c.header("X-RateLimit-Policy", "fail-open");
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
      console.error("[rate-limit] ERROR: Model rate limit check failed -- failing OPEN:", err);
      // Fail open on error
      c.header("X-RateLimit-Limit", "unlimited");
      c.header("X-RateLimit-Remaining", "unlimited");
      c.header("X-RateLimit-Policy", "fail-open-error");
      await next();
    }
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

    if (!redis || !ready) {
      console.warn("[rate-limit] WARNING: Redis unavailable -- failing OPEN for rate limiting");
      c.header("X-RateLimit-Limit", String(maxRequests));
      c.header("X-RateLimit-Remaining", "unlimited");
      c.header("X-RateLimit-Policy", "fail-open");
      await next();
      return;
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
    } catch {
      console.error("[rate-limit] ERROR: Redis operation failed -- failing OPEN for rate limiting");
      // Fail open on error
      c.header("X-RateLimit-Limit", String(maxRequests));
      c.header("X-RateLimit-Remaining", "unlimited");
      c.header("X-RateLimit-Policy", "fail-open-error");
    }

    await next();
  };
}
