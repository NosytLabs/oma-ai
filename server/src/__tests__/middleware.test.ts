// @ts-nocheck — test file with complex Hono context mocking
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { securityHeaders } from "../middleware/security.js";
import { requestTimeout } from "../middleware/timeout.js";
import { createAuditLogger, auditWriteOp } from "../middleware/audit.js";
import { checkIdempotencyKey, storeIdempotencyResult, releaseIdempotencyLock } from "../middleware/idempotency.js";
import { spendLimit } from "../middleware/spend-limit.js";

vi.mock("../lib/redis-client.js", () => ({
  getRedisClient: vi.fn(),
  isRedisReady: vi.fn(),
}));

vi.mock("../db/client.js", () => ({
  db: { insert: vi.fn() },
}));

vi.mock("../db/schema.js", () => ({
  auditLogs: { $inferInsert: {} },
}));

vi.mock("../config.js", () => ({
  config: {
    SPEND_LIMIT_DAILY_CENTS: 10000,
    NODE_ENV: "test",
  },
}));

vi.mock("../lib/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../credits/budget-alerts.js", () => ({
  checkBudgetThresholds: vi.fn(),
  getBudgetAlertConfig: vi.fn(),
  processBudgetAlert: vi.fn(),
}));

import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { db } from "../db/client.js";

function mockRedis(commands: Record<string, unknown>) {
  const client = {
    get: vi.fn((key: string) => Promise.resolve((commands as Record<string, string>)[key] ?? null)),
    set: vi.fn(),
    setEx: vi.fn(),
    setNX: vi.fn(),
    del: vi.fn(),
    incrByFloat: vi.fn(),
    ttl: vi.fn(),
    expire: vi.fn(),
  };
  vi.mocked(getRedisClient).mockResolvedValue(client as any);
  return client;
}

function mockRedisNull() {
  vi.mocked(getRedisClient).mockResolvedValue(null);
}

// ─── security.ts ────────────────────────────────────────────────────────────

describe("securityHeaders middleware", () => {
  it("sets all required security headers", async () => {
    const app = new Hono();
    app.use("*", securityHeaders);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);

    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
    expect(res.headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains");
    expect(res.headers.get("x-xss-protection")).toBe("0");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(res.headers.get("content-security-policy")).toContain("object-src 'none'");
  });

  it("allows request to proceed after setting headers", async () => {
    const app = new Hono();
    app.use("*", securityHeaders);
    app.get("/test", (c) => c.json({ passed: true }));

    const res = await app.request("/test");
    const body = await res.json();
    expect((body as any).passed).toBe(true);
  });

  it("sets headers on error responses too", async () => {
    const app = new Hono();
    app.use("*", securityHeaders);
    app.get("/test", (c) => c.json({ fail: true }, 500));

    const res = await app.request("/test");
    expect(res.status).toBe(500);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });
});

// ─── timeout.ts ─────────────────────────────────────────────────────────────

describe("requestTimeout middleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes through when request completes fast", async () => {
    const app = new Hono();
    app.use("*", requestTimeout(1000));
    app.get("/fast", (c) => c.json({ fast: true }));

    const res = await app.request("/fast");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect((body as any).fast).toBe(true);
  });

  it("returns 408 when request exceeds timeout", async () => {
    const app = new Hono();

    app.use("*", requestTimeout(50));
    app.get("/slow", async (c) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return c.json({ slow: true });
    });

    const resPromise = app.request("/slow");
    vi.advanceTimersByTime(100);
    const res = await resPromise;
    expect(res.status).toBe(408);
    const body = await res.json();
    expect((body as any).error).toBe("Request timeout");
  });

  it("uses default timeout of 120s", async () => {
    const app = new Hono();
    app.use("*", requestTimeout());
    app.get("/ok", (c) => c.json({ ok: true }));

    const res = await app.request("/ok");
    expect(res.status).toBe(200);
  });
});

// ─── audit.ts ───────────────────────────────────────────────────────────────

describe("createAuditLogger middleware", () => {
  it("logs request info and calls next", async () => {
    const mockInsert = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: mockInsert } as any);

    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("userId", "user-123");
      await next();
    });
    app.use("*", createAuditLogger({ action: "api_key.created", resource: "api_key" }));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { "user-agent": "test-agent", "x-forwarded-for": "10.0.0.1, 127.0.0.1" },
    });

    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const values = mockInsert.mock.calls[0][0];
    expect(values.action).toBe("api_key.created");
    expect(values.resource).toBe("api_key");
    expect(values.userId).toBe("user-123");
    expect(values.userAgent).toBe("test-agent");
    // H-6: Audit IP extraction now takes the leftmost (client) entry per RFC 7239
    expect(values.ipAddress).toBe("10.0.0.1");
  });

  it("extracts IP from x-real-ip header", async () => {
    const mockInsert = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: mockInsert } as any);

    const app = new Hono();
    app.use("*", createAuditLogger({ action: "api_key.created", resource: "api_key" }));
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("/test", {
      headers: { "x-real-ip": "192.168.1.1" },
    });

    const values = mockInsert.mock.calls[0][0];
    expect(values.ipAddress).toBe("192.168.1.1");
  });

  it("falls back to unknown IP when no headers present", async () => {
    const mockInsert = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: mockInsert } as any);

    const app = new Hono();
    app.use("*", createAuditLogger({ action: "api_key.created", resource: "api_key" }));
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("/test");

    const values = mockInsert.mock.calls[0][0];
    expect(values.ipAddress).toBe("unknown");
  });

  it("auditWriteOp passes resourceId and metadata from functions", async () => {
    const mockInsert = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: mockInsert } as any);

    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("userId", "user-456");
      await next();
    });
    app.use(
      "*",
      auditWriteOp(
        "credit.deposit",
        "credit",
        (_c) => "resource-999",
        (_c) => ({ amount: 500, currency: "usdc" }),
      ),
    );
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("/test");

    const values = mockInsert.mock.calls[0][0];
    expect(values.action).toBe("credit.deposit");
    expect(values.resource).toBe("credit");
    expect(values.resourceId).toBe("resource-999");
    expect(values.userId).toBe("user-456");
    expect(JSON.parse(values.metadata)).toEqual({ amount: 500, currency: "usdc" });
  });
});

// ─── idempotency.ts ─────────────────────────────────────────────────────────

describe("checkIdempotencyKey", () => {
  const VALID_KEY = "550e8400-e29b-41d4-a716-446655440000";

  it("returns null for invalid key (special characters)", async () => {
    mockRedis({});
    const result = await checkIdempotencyKey("not a key!");
    expect(result).toBeNull();
  });

  it("returns null for too-short key", async () => {
    mockRedis({});
    const result = await checkIdempotencyKey("short");
    expect(result).toBeNull();
  });

  it("returns null for too-long key", async () => {
    mockRedis({});
    const result = await checkIdempotencyKey("a".repeat(200));
    expect(result).toBeNull();
  });

  it("returns null when Redis is unavailable", async () => {
    mockRedisNull();
    const result = await checkIdempotencyKey(VALID_KEY);
    expect(result).toBeNull();
  });

  it("returns { isNew: true } for a new key", async () => {
    const client = mockRedis({});
    client.setNX.mockResolvedValue(true);
    client.expire.mockResolvedValue(true);

    const result = await checkIdempotencyKey(VALID_KEY);
    expect(result).toEqual({ isNew: true });
    expect(client.setNX).toHaveBeenCalledWith(`idem:${VALID_KEY}`, expect.any(String));
  });

  it("returns cached response when key already exists with completed status", async () => {
    const cachedResponse = { status: "completed", data: { id: 1 } };
    mockRedis({ [`idem:${VALID_KEY}`]: JSON.stringify(cachedResponse) });

    const result = await checkIdempotencyKey(VALID_KEY);
    expect(result).toEqual({ isNew: false, existingResponse: cachedResponse });
  });

  it("allows re-acquisition when processing lock is stale", async () => {
    const staleLock = JSON.stringify({ status: "processing", createdAt: Date.now() - 60000 });
    const client = mockRedis({ [`idem:${VALID_KEY}`]: staleLock });
    client.ttl.mockResolvedValue(0);
    client.setNX.mockResolvedValue(true);
    client.expire.mockResolvedValue(true);

    const result = await checkIdempotencyKey(VALID_KEY);
    expect(result).toEqual({ isNew: true });
  });
});

describe("storeIdempotencyResult", () => {
  it("stores response in Redis with TTL", async () => {
    const client = mockRedis({});
    client.setEx.mockResolvedValue("OK");

    await storeIdempotencyResult("550e8400-e29b-41d4-a716-446655440000", { ok: true }, 3600);
    expect(client.setEx).toHaveBeenCalledWith(
      "idem:550e8400-e29b-41d4-a716-446655440000",
      3600,
      JSON.stringify({ ok: true }),
    );
  });

  it("does nothing when Redis is unavailable", async () => {
    mockRedisNull();
    await expect(
      storeIdempotencyResult("550e8400-e29b-41d4-a716-446655440000", { ok: true }),
    ).resolves.toBeUndefined();
  });
});

describe("releaseIdempotencyLock", () => {
  it("deletes lock from Redis", async () => {
    const client = mockRedis({});
    client.del.mockResolvedValue(1);

    await releaseIdempotencyLock("550e8400-e29b-41d4-a716-446655440000");
    expect(client.del).toHaveBeenCalledWith("idem:550e8400-e29b-41d4-a716-446655440000");
  });

  it("does nothing for invalid key", async () => {
    const client = mockRedis({});
    await releaseIdempotencyLock("not a key!");
    expect(client.del).not.toHaveBeenCalled();
  });

  it("does nothing when Redis is unavailable", async () => {
    mockRedisNull();
    await expect(
      releaseIdempotencyLock("550e8400-e29b-41d4-a716-446655440000"),
    ).resolves.toBeUndefined();
  });
});

// ─── spend-limit.ts ─────────────────────────────────────────────────────────

describe("spendLimit middleware", () => {
  beforeEach(() => {
    vi.mocked(isRedisReady).mockReturnValue(true);
  });

  it("passes through when no apiKey is set", async () => {
    mockRedis({});

    const app = new Hono();
    app.use("*", spendLimit());
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("returns 503 when Redis is unavailable", async () => {
    mockRedisNull();

    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("apiKey", { id: "k1", userId: "u1", keyPrefix: "test", keyHash: "hash1", name: "key", active: true, createdAt: new Date() });
      await next();
    });
    app.use("*", spendLimit());
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect((body as any).error.code).toBe("rate_limit_unavailable");
  });

  it("returns 503 when isRedisReady returns false", async () => {
    vi.mocked(isRedisReady).mockReturnValue(false);
    const client = mockRedis({});
    client.get.mockResolvedValue(null);

    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("apiKey", { id: "k1", userId: "u1", keyPrefix: "test", keyHash: "hash1", name: "key", active: true, createdAt: new Date() });
      await next();
    });
    app.use("*", spendLimit());
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(503);
  });

  it("blocks with 429 when spend limit exceeded", async () => {
    const client = mockRedis({});
    client.get.mockResolvedValue("10000");

    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("apiKey", { id: "k1", userId: "u1", keyPrefix: "test", keyHash: "hash1", name: "key", active: true, createdAt: new Date() });
      await next();
    });
    app.use("*", spendLimit());
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(429);
    expect(res.headers.get("x-spend-limit-exceeded")).toBe("1");
    const body = await res.json();
    expect((body as any).error.code).toBe("spend_limit_exceeded");
  });

  it("passes through when under spend limit", async () => {
    const client = mockRedis({});
    client.get.mockResolvedValue("5000");

    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("apiKey", { id: "k1", userId: "u1", keyPrefix: "test", keyHash: "hash1", name: "key", active: true, createdAt: new Date() });
      await next();
    });
    app.use("*", spendLimit());
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("passes through when no spend record exists", async () => {
    const client = mockRedis({});
    client.get.mockResolvedValue(null);

    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("apiKey", { id: "k1", userId: "u1", keyPrefix: "test", keyHash: "hash1", name: "key", active: true, createdAt: new Date() });
      await next();
    });
    app.use("*", spendLimit());
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });
});
