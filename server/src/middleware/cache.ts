import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";
import { createHash } from "crypto";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";

let redisReady = false;

interface CacheOptions {
  ttlSeconds?: number;
  keyPrefix?: string;
  varyHeaders?: string[];
  excludeMethods?: string[];
}

const DEFAULT_TTL = 300; // 5 minutes
const DEFAULT_KEY_PREFIX = "cache";
const DEFAULT_VARY_HEADERS = ["x-api-key"];
const DEFAULT_EXCLUDE_METHODS = ["POST"]; // Only cache POST requests by default

async function getRedis() {
  const redisClient = await getRedisClient();
  redisReady = isRedisReady();
  if (redisClient && redisReady) return redisClient;
  return null;
}

function hashFingerprint(data: string): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 32);
}

function extractFingerprint(body: unknown, varyParams: string[]): string {
  const parts: Record<string, unknown> = {};

  for (const param of varyParams) {
    const value = (body as Record<string, unknown>)?.[param];
    if (value !== undefined) {
      parts[param] = value;
    }
  }

  return JSON.stringify(parts);
}

export function createCacheMiddleware(options: CacheOptions = {}) {
  const {
    ttlSeconds = DEFAULT_TTL,
    keyPrefix = DEFAULT_KEY_PREFIX,
    varyHeaders = DEFAULT_VARY_HEADERS,
    excludeMethods = DEFAULT_EXCLUDE_METHODS,
  } = options;

  return async (c: Context<OmaEnv>, next: Next) => {
    // Skip caching based on method
    const method = c.req.method.toUpperCase();
    if (excludeMethods.includes(method)) {
      return next();
    }

    // Check for cache bypass header
    if (c.req.header("x-cache-bypass") === "true") {
      c.header("X-Cache-Status", "bypass");
      return next();
    }

    // Only cache successful responses
    const cacheableMethods = ["GET", "POST", "PUT", "PATCH"];
    if (!cacheableMethods.includes(method)) {
      return next();
    }

    // Parse request body for fingerprinting
    let body: unknown = null;
    try {
      const rawBody = await c.req.raw.clone().text();
      if (rawBody) {
        body = JSON.parse(rawBody);
      }
    } catch {
      // Non-JSON body, skip caching
      return next();
    }

    if (!body || typeof body !== "object") {
      return next();
    }

    // Build vary parameters from request body
    const varyParams = [
      "model",
      "messages",
      "temperature",
      "max_tokens",
      "top_p",
      "frequency_penalty",
      "presence_penalty",
      "stop",
      "response_format",
      "tools",
      "tool_choice",
      "stream",
    ];

    // Get header-based vary values
    const headerValues: Record<string, string | undefined> = {};
    for (const header of varyHeaders) {
      headerValues[header] = c.req.header(header);
    }

    // Create cache key
    const fingerprintData = JSON.stringify({
      body: extractFingerprint(body, varyParams),
      headers: headerValues,
      method,
    });
    const fingerprint = hashFingerprint(fingerprintData);
    const cacheKey = `${keyPrefix}:response:${fingerprint}`;

    const redis = await getRedis();

    // If Redis is unavailable, proceed without caching
    if (!redis || !redisReady) {
      return next();
    }

    try {
      // Try to get cached response
      const cached = await redis.get(cacheKey);

      if (cached) {
        const cachedData = JSON.parse(cached);
        const now = Date.now();

        // Check if cache has expired (using stored expiry)
        if (cachedData.expiresAt && cachedData.expiresAt < now) {
          await redis.del(cacheKey);
        } else {
          // Return cached response
          c.header("X-Cache-Hit", "true");
          c.header("X-Cache-Key", fingerprint);
          c.header("Cache-Control", `private, max-age=${Math.max(0, Math.floor((cachedData.expiresAt - now) / 1000))}`);

          // Set age header
          if (cachedData.createdAt) {
            const age = Math.floor((now - cachedData.createdAt) / 1000);
            c.header("Age", String(age));
          }

          return c.json(cachedData.response, 200);
        }
      }

      // Proceed with request and cache the response
      await next();

      // Only cache successful responses (2xx status codes)
      const status = c.res.status;
      if (status >= 200 && status < 300) {
        let responseBody: unknown;
        try {
          const text = await c.res.text();
          responseBody = JSON.parse(text);
        } catch {
          // Non-JSON response, skip caching
          return;
        }

        const now = Date.now();
        const cacheData = {
          response: responseBody,
          createdAt: now,
          expiresAt: now + ttlSeconds * 1000,
          statusCode: status,
        };

        // Store in Redis with TTL
        await redis.setEx(cacheKey, ttlSeconds, JSON.stringify(cacheData));

        // Add cache headers to response
        c.header("X-Cache-Hit", "false");
        c.header("X-Cache-Key", fingerprint);
        c.header("Cache-Control", `private, max-age=${ttlSeconds}`);
      }
    } catch (err) {
      console.error("[cache] Redis operation failed:", err);
      // On Redis error, proceed without caching
      return next();
    }
  };
}

// Preset cache configurations for common use cases
export const chatCache = createCacheMiddleware({
  ttlSeconds: 300, // 5 minutes
  keyPrefix: "chat",
  varyHeaders: ["authorization"],
  excludeMethods: [],
});

export const modelListCache = createCacheMiddleware({
  ttlSeconds: 3600, // 1 hour
  keyPrefix: "models",
  varyHeaders: [],
  excludeMethods: ["POST", "PUT", "PATCH", "DELETE"],
});

// Export utility for cache invalidation
export async function invalidateCache(keyPattern: string): Promise<number> {
  const redis = await getRedis();
  if (!redis || !redisReady) return 0;

  try {
    const pattern = `${keyPattern}:response:*`;
    let cursor = 0;
    let totalDeleted = 0;

    do {
      const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      const keys = result.keys;

      if (keys.length > 0) {
        const deleted = await redis.del(keys);
        totalDeleted += deleted;
      }
    } while (cursor !== 0);

    return totalDeleted;
  } catch (err) {
    console.error("[cache] Invalidation failed:", err);
    return 0;
  }
}