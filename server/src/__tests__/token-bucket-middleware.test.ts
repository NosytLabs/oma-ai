import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context, Next } from "hono";

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

vi.mock("../lib/logger.js", () => ({
  logger: mockLogger,
}));

const mockRedis = {
  eval: vi.fn(),
};

const mockGetRedisClient = vi.fn();
const mockIsRedisReady = vi.fn();

vi.mock("../lib/redis-client.js", () => ({
  getRedisClient: (...args: unknown[]) => mockGetRedisClient(...args),
  isRedisReady: (...args: unknown[]) => mockIsRedisReady(...args),
}));

vi.mock("../lib/rate-limit-config.js", () => ({
  getApiKeyRateLimits: vi.fn(() => ({ rpm: 60, tpm: 120_000 })),
}));

// Import after mocks are set up
const {
  checkTokenBucket,
  tokenBucket,
} = await import("../middleware/rate-limit/token-bucket.js");

const { checkFallbackLimit: _checkFallbackLimit, FALLBACK_BURST_LIMIT } = await import(
  "../middleware/rate-limit/memory-store.js"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(
  overrides: {
    apiKey?: { id: string; userId: string; keyPrefix: string; keyHash: string; name: string; active: boolean; createdAt: Date };
    userId?: string;
    apiKeyId?: string;
    xForwardedFor?: string;
    xRealIp?: string;
    method?: string;
    jsonBody?: Record<string, unknown>;
  } = {}
) {
  const headers: Record<string, string> = {};
  const variables: Record<string, unknown> = {};

  if (overrides.apiKey) variables.apiKey = overrides.apiKey;
  if (overrides.userId) variables.userId = overrides.userId;

  const jsonCalls: Array<{ body: unknown; status: number }> = [];

  const c = {
    req: {
      header: (name: string) => {
        if (name === "x-forwarded-for") return overrides.xForwardedFor;
        if (name === "x-real-ip") return overrides.xRealIp;
        return undefined;
      },
      method: overrides.method ?? "POST",
      json: async () => overrides.jsonBody ?? {},
    },
    get: (key: string) => variables[key],
    set: (key: string, value: unknown) => {
      variables[key] = value;
    },
    header: (name: string, value: string) => {
      headers[name] = value;
    },
    json: (body: unknown, status: number) => {
      jsonCalls.push({ body, status });
      return new Response(JSON.stringify(body), { status });
    },
  } as unknown as Context;

  return { c, headers, variables, jsonCalls };
}

function createMockNext(): Next {
  return vi.fn() as unknown as Next;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRedisClient.mockResolvedValue(mockRedis);
  mockIsRedisReady.mockReturnValue(true);
});

// ---- checkTokenBucket (unit) ---------------------------------------------

describe("checkTokenBucket", () => {
  it("should return allowed when tokens are sufficient", async () => {
    // Lua returns [1, remaining, 0]
    mockRedis.eval.mockResolvedValueOnce([1, 55, 0]);

    const result = await checkTokenBucket(mockRedis as never, "tb:user1", {
      bucketSize: 60,
      refillRate: 20,
    });

    expect(result).toEqual({
      allowed: true,
      remaining: 55,
      resetMs: 0,
      limit: 60,
    });
    expect(mockRedis.eval).toHaveBeenCalledOnce();
  });

  it("should return not allowed when tokens are insufficient", async () => {
    // Lua returns [0, remaining_tokens, ms_until_full]
    mockRedis.eval.mockResolvedValueOnce([0, 0, 5000]);

    const result = await checkTokenBucket(mockRedis as never, "tb:user1", {
      bucketSize: 60,
      refillRate: 20,
    });

    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      resetMs: 5000,
      limit: 60,
    });
  });

  it("should pass requested tokens to Redis", async () => {
    mockRedis.eval.mockResolvedValueOnce([1, 45, 0]);

    await checkTokenBucket(
      mockRedis as never,
      "tb:user1",
      { bucketSize: 60, refillRate: 20 },
      15
    );

    const args = mockRedis.eval.mock.calls[0];
    expect(args[3]).toBe(60); // bucketSize
    expect(args[4]).toBe(20); // refillRate
    expect(args[5]).toBe(15); // requested
  });

  it("should default requested to 1", async () => {
    mockRedis.eval.mockResolvedValueOnce([1, 59, 0]);

    await checkTokenBucket(mockRedis as never, "tb:user1", {
      bucketSize: 60,
      refillRate: 20,
    });

    expect(mockRedis.eval.mock.calls[0][5]).toBe(1);
  });

  it("should throw and log on Redis error", async () => {
    const redisError = new Error("ETIMEDOUT");
    mockRedis.eval.mockRejectedValueOnce(redisError);

    await expect(
      checkTokenBucket(mockRedis as never, "tb:user1", {
        bucketSize: 60,
        refillRate: 20,
      })
    ).rejects.toThrow("ETIMEDOUT");

    expect(mockLogger.error).toHaveBeenCalledWith(
      { err: redisError },
      "Token bucket script error"
    );
  });
});

// ---- tokenBucket middleware -----------------------------------------------

describe("tokenBucket middleware", () => {
  describe("fail-closed when Redis unavailable", () => {
    it("should use in-memory fallback when getRedisClient returns null", async () => {
      mockGetRedisClient.mockResolvedValueOnce(null);

      const middleware = tokenBucket({ bucketSize: 60, refillRate: 20 });
      const { c, headers } = createMockContext({
        apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
      });
      const next = createMockNext();

      const response = await (middleware as Function)(c, next);

      expect(response).toBeUndefined();
      expect(next).toHaveBeenCalledOnce();
      expect(headers["X-RateLimit-Policy"]).toBe("fail-closed-conservative");
      expect(headers["X-RateLimit-Limit"]).toBe(String(FALLBACK_BURST_LIMIT));
    });

    it("should block with 503 when in-memory fallback is exhausted", async () => {
      mockGetRedisClient.mockResolvedValueOnce(null);

      const middleware = tokenBucket({ bucketSize: 60, refillRate: 20 });
      const next = createMockNext();

      // Exhaust the fallback limit for key "tb:k1"
      for (let i = 0; i < FALLBACK_BURST_LIMIT; i++) {
        const { c } = createMockContext({
          apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
        });
        mockGetRedisClient.mockResolvedValue(null);
        mockIsRedisReady.mockReturnValue(false);
        await (middleware as Function)(c, createMockNext());
      }

      // Next request should be blocked
      mockGetRedisClient.mockResolvedValue(null);
      mockIsRedisReady.mockReturnValue(false);
      const { c, headers } = createMockContext({
        apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
      });

      const response = await (middleware as Function)(c, next);

      expect(response).toBeInstanceOf(Response);
      const body = await response.json();
      expect(body.error.code).toBe("rate_limit_unavailable");
      expect(headers["X-RateLimit-Remaining"]).toBe("0");
    });

    it("should fall back to in-memory and eventually block when exhausted", async () => {
      // Ensure Redis is always unavailable for all calls
      mockGetRedisClient.mockResolvedValue(null);
      mockIsRedisReady.mockReturnValue(false);

      const middleware = tokenBucket({ bucketSize: 60, refillRate: 20 });

      // Exhaust the fallback limit for key "tb:k1"
      for (let i = 0; i < FALLBACK_BURST_LIMIT; i++) {
        const { c: ctx } = createMockContext({
          apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
        });
        const next = createMockNext();
        await (middleware as Function)(ctx, next);
      }

      // Next request should be blocked with 503
      const { c: blockedCtx, headers } = createMockContext({
        apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
      });
      const next = createMockNext();
      const response = await (middleware as Function)(blockedCtx, next);

      expect(response).toBeInstanceOf(Response);
      const body = await response.json();
      expect(body.error.code).toBe("rate_limit_unavailable");
      expect(headers["X-RateLimit-Remaining"]).toBe("0");
    });
  });

  describe("successful token bucket checks", () => {
    it("should allow request when under token limit", async () => {
      // Token bucket allows + RPM allows (checkRpm defaults to true)
      mockRedis.eval
        .mockResolvedValueOnce([1, 50, 0])  // token bucket: 50 remaining
        .mockResolvedValueOnce([1, 5, 0]);  // RPM: 5 used, 55 remaining

      const middleware = tokenBucket({ bucketSize: 60, refillRate: 20 });
      const { c, headers } = createMockContext({
        apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
      });
      const next = createMockNext();

      const response = await (middleware as Function)(c, next);

      expect(next).toHaveBeenCalledOnce();
      expect(response).toBeUndefined();
      expect(headers["X-RateLimit-Limit"]).toBe("60");
      // RPM remaining (55) > token remaining (50), so token remaining wins
      expect(headers["X-RateLimit-Remaining"]).toBe("50");
      expect(headers["X-RateLimit-Policy"]).toBe("token-bucket");
    });

    it("should set rateLimit on context", async () => {
      mockRedis.eval
        .mockResolvedValueOnce([1, 40, 0])  // token bucket
        .mockResolvedValueOnce([1, 55, 0]); // RPM

      const middleware = tokenBucket({ bucketSize: 60, refillRate: 20 });
      const { c, variables } = createMockContext({
        apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
      });
      const next = createMockNext();

      await (middleware as Function)(c, next);

      expect(variables.rateLimit).toEqual({
        remaining: 40,
        reset: expect.any(Number),
      });
    });

    it("should reject with 429 when token bucket is empty", async () => {
      mockRedis.eval.mockResolvedValueOnce([0, 0, 5000]); // token bucket: not allowed

      const middleware = tokenBucket({ bucketSize: 60, refillRate: 20, checkRpm: false });
      const { c, headers } = createMockContext({
        apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
      });
      const next = createMockNext();

      const response = await (middleware as Function)(c, next);

      expect(next).not.toHaveBeenCalled();
      expect(response).toBeInstanceOf(Response);
      const body = await response.json();
      expect(body.error.code).toBe("rate_limit_exceeded");
      expect(headers["X-RateLimit-Remaining"]).toBe("0");
      expect(headers["Retry-After"]).toBeDefined();
    });
  });

  describe("RPM sliding window check", () => {
    it("should reject when RPM limit is exceeded even if tokens remain", async () => {
      // First call: token bucket allows
      mockRedis.eval
        .mockResolvedValueOnce([1, 50, 0])
        // Second call: RPM limit exceeded
        .mockResolvedValueOnce([0, 60, 30_000]);

      const middleware = tokenBucket({
        bucketSize: 60,
        refillRate: 20,
        checkRpm: true,
        rpmLimit: 60,
      });
      const { c, headers } = createMockContext({
        apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
      });
      const next = createMockNext();

      const response = await (middleware as Function)(c, next);

      expect(next).not.toHaveBeenCalled();
      expect(response).toBeInstanceOf(Response);
      const body = await response.json();
      expect(body.error.code).toBe("rate_limit_exceeded");
      expect(body.error.retryAfter).toBeDefined();
      expect(headers["Retry-After"]).toBeDefined();
    });

    it("should use the smaller remaining count from RPM or token bucket", async () => {
      // Token bucket: 50 remaining
      mockRedis.eval
        .mockResolvedValueOnce([1, 50, 0])
        // RPM: 5 remaining (smaller)
        .mockResolvedValueOnce([1, 55, 0]);

      const middleware = tokenBucket({
        bucketSize: 60,
        refillRate: 20,
        checkRpm: true,
        rpmLimit: 60,
      });
      const { c, headers } = createMockContext({
        apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
      });
      const next = createMockNext();

      await (middleware as Function)(c, next);

      // RPM remaining (5) is less than token bucket remaining (50)
      expect(headers["X-RateLimit-Remaining"]).toBe("5");
    });

    it("should skip RPM check when checkRpm is false", async () => {
      mockRedis.eval.mockResolvedValueOnce([1, 50, 0]);

      const middleware = tokenBucket({
        bucketSize: 60,
        refillRate: 20,
        checkRpm: false,
      });
      const { c } = createMockContext({
        apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
      });
      const next = createMockNext();

      await (middleware as Function)(c, next);

      // Only one eval call (token bucket), no RPM call
      expect(mockRedis.eval).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe("fail-closed on catch block (Redis error during check)", () => {
    it("should return 503 when token bucket eval throws", async () => {
      mockRedis.eval.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const middleware = tokenBucket({ bucketSize: 60, refillRate: 20 });
      const { c, headers } = createMockContext({
        apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
      });
      const next = createMockNext();

      const response = await (middleware as Function)(c, next);

      expect(next).not.toHaveBeenCalled();
      expect(response).toBeInstanceOf(Response);
      const body = await response.json();
      expect(body.error.code).toBe("rate_limit_unavailable");
      expect(headers["X-RateLimit-Policy"]).toBe("fail-closed-error");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        "CRITICAL: Rate limit check failed -- failing CLOSED"
      );
    });

    it("should return 503 when RPM eval throws after token bucket succeeds", async () => {
      // Token bucket succeeds
      mockRedis.eval
        .mockResolvedValueOnce([1, 50, 0])
        // RPM check throws
        .mockRejectedValueOnce(new Error("Redis timeout"));

      const middleware = tokenBucket({
        bucketSize: 60,
        refillRate: 20,
        checkRpm: true,
      });
      const { c } = createMockContext({
        apiKey: { id: "k1", userId: "u1", keyPrefix: "pk", keyHash: "h", name: "test", active: true, createdAt: new Date() },
      });
      const next = createMockNext();

      const response = await (middleware as Function)(c, next);

      expect(response).toBeInstanceOf(Response);
      const body = await response.json();
      expect(body.error.code).toBe("rate_limit_unavailable");
    });
  });
});

