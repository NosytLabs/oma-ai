/**
 * Regression test for SEC-7 — middleware race in OMA-AI.
 *
 * Target:  server/src/auth/middleware.ts
 * Session:  ses_1
 *
 * The race: N concurrent requests with the same API key all reach
 * `validateApiKey` in parallel. Each one runs a separate DB transaction
 * (with its own SELECT ... FOR UPDATE + lastUsedAt write). The fix
 * wraps the validateApiKey call in a per-key singleflight so that N
 * concurrent callers share one in-flight promise and the underlying
 * function is invoked exactly once.
 *
 * This test exercises:
 *   1. The `singleflight` helper directly (dedup, isolation, retry on error).
 *   2. The end-to-end `bearerAuth` middleware via Hono's test client,
 *      firing N concurrent requests with the same Authorization header
 *      and asserting that `validateApiKey` was called exactly once.
 *
 * The test stays in the repo as a permanent regression guard.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { OmaEnv } from "../../types.js";

// Track validateApiKey invocations across all tests in this file.
let validateCallCount = 0;

vi.mock("../api-keys.js", () => ({
  // Slow mock — simulates the DB round-trip so concurrent callers actually
  // overlap. Returns a valid, non-expired key with no IP allowlist.
  validateApiKey: vi.fn(async (rawKey: string) => {
    validateCallCount++;
    await new Promise((r) => setTimeout(r, 15));
    return {
      id: "key-id-123",
      userId: "user-id-456",
      keyHash: "h",
      keyPrefix: rawKey.slice(0, 12),
      active: true,
      expiresAt: null,
      createdAt: new Date("2025-01-01"),
      ipAllowlist: null,
      allowedModels: null,
    };
  }),
  isIpAllowedByList: vi.fn(() => true),
  shouldRecommendRotation: vi.fn(() => false),
}));

vi.mock("../siwe.js", () => ({
  verifySessionToken: vi.fn(),
}));

vi.mock("../encryption.js", () => ({
  decryptSecret: vi.fn(),
}));

vi.mock("../../db/client.js", () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock("../../db/schema.js", () => ({
  users: {
    id: "id",
    twoFactorEnabled: "2fa_enabled",
    twoFactorSecret: "2fa_secret",
    address: "address",
  },
  teamMembers: { userId: "uid", teamId: "tid", role: "role" },
}));

vi.mock("../../lib/redis-client.js", () => ({
  getRedisClient: vi.fn(async () => null),
  isRedisReady: vi.fn(() => false),
}));

vi.mock("../../middleware/rate-limit/utils.js", () => ({
  extractClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@otplib/preset-default", () => ({
  authenticator: { verify: vi.fn(() => true) },
}));

vi.mock("../../config.js", () => ({
  config: {
    NODE_ENV: "development",
    ADMIN_WALLET_ADDRESSES: undefined,
    PLATFORM_TEAM_ID: "",
  },
  ADMIN_WALLET_ADDRESSES_SET: new Set<string>(),
}));

// Imports AFTER mocks so the module is bound to the mocks above.
import { bearerAuth, singleflight } from "../middleware.js";
import { validateApiKey } from "../api-keys.js";

const mockedValidate = validateApiKey as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  validateCallCount = 0;
  vi.clearAllMocks();
});

describe("SEC-7 singleflight helper", () => {
  it("exports a function", () => {
    expect(typeof singleflight).toBe("function");
  });

  it("dedupes concurrent calls sharing the same key", async () => {
    let inner = 0;
    const [a, b, c, d, e] = await Promise.all([
      singleflight("k1", async () => {
        inner++;
        await new Promise((r) => setTimeout(r, 10));
        return "v";
      }),
      singleflight("k1", async () => {
        inner++;
        await new Promise((r) => setTimeout(r, 10));
        return "v";
      }),
      singleflight("k1", async () => {
        inner++;
        await new Promise((r) => setTimeout(r, 10));
        return "v";
      }),
      singleflight("k1", async () => {
        inner++;
        await new Promise((r) => setTimeout(r, 10));
        return "v";
      }),
      singleflight("k1", async () => {
        inner++;
        await new Promise((r) => setTimeout(r, 10));
        return "v";
      }),
    ]);
    expect(inner).toBe(1);
    expect([a, b, c, d, e]).toEqual(["v", "v", "v", "v", "v"]);
  });

  it("does not coalesce calls with different keys", async () => {
    let aCount = 0;
    let bCount = 0;
    const [a, b] = await Promise.all([
      singleflight("alpha", async () => {
        aCount++;
        return "A";
      }),
      singleflight("beta", async () => {
        bCount++;
        return "B";
      }),
    ]);
    expect(aCount).toBe(1);
    expect(bCount).toBe(1);
    expect(a).toBe("A");
    expect(b).toBe("B");
  });

  it("clears the lock after a failure so the next call retries", async () => {
    let count = 0;
    await expect(
      singleflight("flaky", async () => {
        count++;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const result = await singleflight("flaky", async () => {
      count++;
      return "ok";
    });
    expect(count).toBe(2);
    expect(result).toBe("ok");
  });

  it("propagates the error to all concurrent awaiters", async () => {
    let count = 0;
    const settled = await Promise.allSettled([
      singleflight("errk", async () => {
        count++;
        await new Promise((r) => setTimeout(r, 5));
        throw new Error("kaboom");
      }),
      singleflight("errk", async () => {
        count++;
        await new Promise((r) => setTimeout(r, 5));
        throw new Error("kaboom");
      }),
    ]);
    expect(count).toBe(1);
    expect(settled[0].status).toBe("rejected");
    expect(settled[1].status).toBe("rejected");
    if (settled[0].status === "rejected") {
      expect((settled[0] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    }
  });
});

describe("SEC-7 bearerAuth — concurrent requests with the same API key", () => {
  function makeApp(): Hono<OmaEnv> {
    const app = new Hono<OmaEnv>();
    app.use("*", bearerAuth);
    app.get("/probe", (c) => c.json({ ok: true }));
    return app;
  }

  it("invokes validateApiKey exactly once for N=10 concurrent requests with the same key", async () => {
    const app = makeApp();
    const rawKey = "oma_sk_concurrent_same_key_0000000000000000";
    const N = 10;

    const responses = await Promise.all(
      Array.from({ length: N }, () =>
        app.request("/probe", {
          headers: { Authorization: `Bearer ${rawKey}` },
        }),
      ),
    );

    expect(mockedValidate).toHaveBeenCalledTimes(1);
    expect(validateCallCount).toBe(1);
    for (const res of responses) {
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
    }
  });

  it("does not coalesce concurrent requests with different keys", async () => {
    const app = makeApp();

    const responses = await Promise.all([
      app.request("/probe", { headers: { Authorization: "Bearer oma_sk_key_a_0000000000000000000000000" } }),
      app.request("/probe", { headers: { Authorization: "Bearer oma_sk_key_b_0000000000000000000000000" } }),
      app.request("/probe", { headers: { Authorization: "Bearer oma_sk_key_c_0000000000000000000000000" } }),
    ]);

    expect(mockedValidate).toHaveBeenCalledTimes(3);
    for (const res of responses) {
      expect(res.status).toBe(200);
    }
  });

  it("lets a second wave of requests through after the first wave completes", async () => {
    const app = makeApp();
    const rawKey = "oma_sk_wave_test_000000000000000000000000000";

    // Wave 1
    await Promise.all(
      Array.from({ length: 5 }, () =>
        app.request("/probe", { headers: { Authorization: `Bearer ${rawKey}` } }),
      ),
    );

    // Wave 2 — same key, but first wave's promise has resolved and been
    // cleared from the inflight map, so this should run a fresh validation.
    await Promise.all(
      Array.from({ length: 5 }, () =>
        app.request("/probe", { headers: { Authorization: `Bearer ${rawKey}` } }),
      ),
    );

    // 2 waves × 1 dedupe = 2 calls.
    expect(mockedValidate).toHaveBeenCalledTimes(2);
  });
});
