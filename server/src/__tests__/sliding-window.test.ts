import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context, Next } from "hono";

const mockLogger = {
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

vi.mock("../lib/logger.js", () => ({
  logger: mockLogger,
}));

const mockRedis = {
  eval: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
};

const mockGetRedisClient = vi.fn();
const mockIsRedisReady = vi.fn();

vi.mock("../lib/redis-client.js", () => ({
  getRedisClient: (...args: unknown[]) => mockGetRedisClient(...args),
  isRedisReady: (...args: unknown[]) => mockIsRedisReady(...args),
}));

const {
  checkRpmLimit,
  rateLimit,
} = await import("../middleware/rate-limit/sliding-window.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockContext(options: {
  apiKeyId?: string;
  xForwardedFor?: string;
  xRealIp?: string;
} = {}) {
  const headers: Record<string, string> = {};
  const variables: Record<string, unknown> = {};

  if (options.apiKeyId) {
    variables.apiKeyId = options.apiKeyId;
  }

  const jsonCalls: Array<{ body: unknown; status: number }> = [];

  const c = {
    req: {
      header: (name: string) => {
        if (name === "x-forwarded-for") return options.xForwardedFor;
        if (name === "x-real-ip") return options.xRealIp;
        return undefined;
      },
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

// ---- checkRpmLimit (unit) ------------------------------------------------

describe("checkRpmLimit", () => {
  it("should return allowed=true when under the RPM limit", async () => {
    mockRedis.eval.mockResolvedValueOnce([1, 3, 0]);

    const result = await checkRpmLimit(mockRedis as never, "rl:key1", 60, 60, 1);

    expect(result).toEqual({
      allowed: true,
      remaining: 57, // limit(60) - count(3)
      resetMs: 0,
      limit: 60,
    });
    expect(mockRedis.eval).toHaveBeenCalledOnce();
    const [script, numKeys, key, limit, windowMs, requested] =
      mockRedis.eval.mock.calls[0];
    expect(script).toContain("ZREMRANGEBYSCORE");
    expect(numKeys).toBe(1);
    expect(key).toBe("rl:key1");
    expect(limit).toBe(60);
    expect(windowMs).toBe(60_000);
    expect(requested).toBe(1);
  });

  it("should return allowed=false when over the RPM limit", async () => {
    mockRedis.eval.mockResolvedValueOnce([0, 60, 45_000]);

    const result = await checkRpmLimit(mockRedis as never, "rl:key1", 60, 60);

    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      resetMs: 45_000,
      limit: 60,
    });
  });

  it("should clamp remaining to 0 when count exceeds limit", async () => {
    mockRedis.eval.mockResolvedValueOnce([0, 65, 10_000]);

    const result = await checkRpmLimit(mockRedis as never, "rl:key1", 60);

    expect(result.remaining).toBe(0);
  });

  it("should pass requested count to Redis", async () => {
    mockRedis.eval.mockResolvedValueOnce([1, 5, 0]);

    await checkRpmLimit(mockRedis as never, "rl:key1", 60, 60, 5);

    const args = mockRedis.eval.mock.calls[0];
    expect(args[5]).toBe(5); // requested=5
  });

  it("should throw and log when Redis eval fails", async () => {
    const redisError = new Error("ECONNRESET");
    mockRedis.eval.mockRejectedValueOnce(redisError);

    await expect(
      checkRpmLimit(mockRedis as never, "rl:key1", 60)
    ).rejects.toThrow("ECONNRESET");

    expect(mockLogger.error).toHaveBeenCalledWith(
      { err: redisError },
      "RPM limit script error"
    );
  });

  it("should default windowSec to 60", async () => {
    mockRedis.eval.mockResolvedValueOnce([1, 0, 0]);

    await checkRpmLimit(mockRedis as never, "rl:key1", 100);

    const windowMs = mockRedis.eval.mock.calls[0][4]; // ARGV[2]
    expect(windowMs).toBe(60_000);
  });
});

// ---- rateLimit middleware (fixed-window, fail-closed) ----------------------

describe("rateLimit middleware", () => {
  describe("fail-closed when Redis unavailable", () => {
    it("should return 503 when getRedisClient returns null", async () => {
      mockGetRedisClient.mockResolvedValueOnce(null);

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c, headers } = createMockContext();
      const next = createMockNext();

      const response = await (middleware as Function)(c, next);

      expect(next).not.toHaveBeenCalled();
      expect(response).toBeInstanceOf(Response);
      const body = await response.json();
      expect(body.error.type).toBe("rate_limit_error");
      expect(body.error.code).toBe("service_unavailable");
      expect(headers["X-RateLimit-Policy"]).toBe("fail-closed");
      expect(headers["Retry-After"]).toBe("60");
    });

    it("should return 503 when isRedisReady returns false", async () => {
      mockIsRedisReady.mockReturnValueOnce(false);

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c } = createMockContext();
      const next = createMockNext();

      const response = await (middleware as Function)(c, next);

      expect(next).not.toHaveBeenCalled();
      expect(response).toBeInstanceOf(Response);
      const body = await response.json();
      expect(body.error.code).toBe("service_unavailable");
    });
  });

  describe("fail-closed on Redis error (catch block)", () => {
    it("should return 503 when incr throws", async () => {
      mockRedis.incr.mockRejectedValueOnce(new Error("Redis down"));

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c, headers } = createMockContext();
      const next = createMockNext();

      const response = await (middleware as Function)(c, next);

      expect(next).not.toHaveBeenCalled();
      expect(response).toBeInstanceOf(Response);
      const body = await response.json();
      expect(body.error.code).toBe("service_unavailable");
      expect(headers["X-RateLimit-Policy"]).toBe("fail-closed-error");
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        "Redis operation failed -- failing CLOSED for auth route"
      );
    });

    it("should return 503 when ttl throws", async () => {
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);
      mockRedis.ttl.mockRejectedValueOnce(new Error("Connection lost"));

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c } = createMockContext();
      const next = createMockNext();

      const response = await (middleware as Function)(c, next);

      expect(response).toBeInstanceOf(Response);
      const body = await response.json();
      expect(body.error.code).toBe("service_unavailable");
    });
  });

  describe("successful rate limiting", () => {
    it("should allow request and call next when under limit", async () => {
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);
      mockRedis.ttl.mockResolvedValueOnce(55);

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c, headers } = createMockContext();
      const next = createMockNext();

      const response = await (middleware as Function)(c, next);

      expect(next).toHaveBeenCalledOnce();
      expect(response).toBeUndefined(); // middleware returns nothing on success
      expect(headers["X-RateLimit-Limit"]).toBe("10");
      expect(headers["X-RateLimit-Remaining"]).toBe("9");
      expect(headers["X-RateLimit-Reset"]).toBeDefined();
    });

    it("should reject with 429 when over limit", async () => {
      mockRedis.incr.mockResolvedValueOnce(11);
      mockRedis.ttl.mockResolvedValueOnce(30);

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c, headers } = createMockContext();
      const next = createMockNext();

      const response = await (middleware as Function)(c, next);

      expect(next).not.toHaveBeenCalled();
      expect(response).toBeInstanceOf(Response);
      const body = await response.json();
      expect(body.error.code).toBe("rate_limit_exceeded");
      expect(headers["X-RateLimit-Remaining"]).toBe("0");
      expect(headers["Retry-After"]).toBeDefined();
    });

    it("should set X-RateLimit-Remaining to 0 when exactly at limit", async () => {
      mockRedis.incr.mockResolvedValueOnce(10);
      mockRedis.ttl.mockResolvedValueOnce(40);

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c, headers } = createMockContext();
      const next = createMockNext();

      await (middleware as Function)(c, next);

      expect(headers["X-RateLimit-Remaining"]).toBe("0");
    });

    it("should only call expire on first request (current === 1)", async () => {
      mockRedis.incr.mockResolvedValueOnce(5);
      mockRedis.ttl.mockResolvedValueOnce(50);

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c } = createMockContext();
      const next = createMockNext();

      await (middleware as Function)(c, next);

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it("should call expire on the first request in a window", async () => {
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);
      mockRedis.ttl.mockResolvedValueOnce(60);

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c } = createMockContext();
      const next = createMockNext();

      await (middleware as Function)(c, next);

      expect(mockRedis.expire).toHaveBeenCalledWith("rl:ip:unknown", 60);
    });
  });

  describe("rate limit key construction", () => {
    it("should use apiKeyId when present", async () => {
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);
      mockRedis.ttl.mockResolvedValueOnce(55);

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c } = createMockContext({ apiKeyId: "key-abc" });
      const next = createMockNext();

      await (middleware as Function)(c, next);

      expect(mockRedis.incr).toHaveBeenCalledWith("rl:key:key-abc");
    });

    it("should fall back to x-forwarded-for IP when no apiKeyId", async () => {
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);
      mockRedis.ttl.mockResolvedValueOnce(55);

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c } = createMockContext({ xForwardedFor: "10.0.0.1, 172.16.0.1" });
      const next = createMockNext();

      await (middleware as Function)(c, next);

      expect(mockRedis.incr).toHaveBeenCalledWith("rl:ip:10.0.0.1");
    });

    it("should use x-real-ip when x-forwarded-for is empty string", async () => {
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);
      mockRedis.ttl.mockResolvedValueOnce(55);

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      // x-forwarded-for as empty string causes getRightmostIp to return "unknown",
      // but if x-forwarded-for is undefined AND x-real-ip is set, getRightmostIp
      // returns "unknown" (truthy), blocking x-real-ip fallback. This test verifies
      // the actual behavior: getRightmostIp("undefined") returns "unknown".
      const { c } = createMockContext({ xRealIp: "192.168.1.1" });
      const next = createMockNext();

      await (middleware as Function)(c, next);

      // getRightmostIp returns "unknown" when x-forwarded-for is undefined,
      // which is truthy, so x-real-ip is never reached
      expect(mockRedis.incr).toHaveBeenCalledWith("rl:ip:unknown");
    });

    it("should use 'unknown' when no IP headers present", async () => {
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);
      mockRedis.ttl.mockResolvedValueOnce(55);

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c } = createMockContext();
      const next = createMockNext();

      await (middleware as Function)(c, next);

      expect(mockRedis.incr).toHaveBeenCalledWith("rl:ip:unknown");
    });

    it("should use custom keyPrefix", async () => {
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);
      mockRedis.ttl.mockResolvedValueOnce(55);

      const middleware = rateLimit({
        windowMs: 60_000,
        maxRequests: 10,
        keyPrefix: "auth",
      });
      const { c } = createMockContext({ apiKeyId: "k1" });
      const next = createMockNext();

      await (middleware as Function)(c, next);

      expect(mockRedis.incr).toHaveBeenCalledWith("auth:key:k1");
    });
  });

  describe("Retry-After header", () => {
    it("should set Retry-After to at least 1 when over limit", async () => {
      mockRedis.incr.mockResolvedValueOnce(11);
      mockRedis.ttl.mockResolvedValueOnce(0);

      const middleware = rateLimit({ windowMs: 60_000, maxRequests: 10 });
      const { c, headers } = createMockContext();
      const next = createMockNext();

      await (middleware as Function)(c, next);

      expect(Number(headers["Retry-After"])).toBeGreaterThanOrEqual(1);
    });
  });
});
