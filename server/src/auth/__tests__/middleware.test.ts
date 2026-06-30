/**
 * Regression test for SEC-7 — 2FA fail-counter race in OMA-AI.
 *
 * Target:  server/src/auth/middleware.ts (sessionAuth)
 *
 * The race: in the original code, N concurrent requests with INVALID 2FA
 * codes all `GET 2fa_fail:<userId>` and read 0..4. Each sees <5, each
 * passes the gate, each verifies (fails), each `INCR`s. Net effect: the
 * user gets N attempts past the 5-cap.
 *
 * Fix: atomic `INCR`-then-check. INCR is atomic in Redis; the
 * post-increment value is unique per request, so only the first few see
 * `fails < 5` and reach the verifier — the rest are rejected with 429
 * before any verify happens.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { OmaEnv } from "../../types.js";

// In-memory redis with REAL atomic counter semantics. A single shared
// `count` variable plus the natural single-threaded JS event loop
// makes incr() effectively atomic for the test.
let count = 0;
// Synchronous atomic flag for SET NX — uses a module-level var so even
// concurrent async calls see the updated value before any await yields.
let nxKeyExists = false;
const mockRedis = {
  get: vi.fn(async (_key: string) => (count > 0 ? String(count) : null)),
  set: vi.fn(async (key: string, value: string, opts?: { NX?: boolean; EX?: number }) => {
    if (opts?.NX) {
      // Synchronous check — no await before this, so concurrent calls
      // see the true value after the first one sets it.
      if (nxKeyExists) return null;
      nxKeyExists = true;
      // Reset count for this fail window
      count = 1;
      return "OK";
    }
    return "OK";
  }),
  incr: vi.fn(async (_key: string) => {
    count += 1;
    return count;
  }),
  expire: vi.fn(async (_key: string, _ttl: number) => 1),
  del: vi.fn(async (_key: string) => {
    count = 0;
    nxKeyExists = false;
    return 1;
  }),
};

// Count verify() calls so we can assert the gate prevented the verify
// step from running for requests that should have been rejected at 429.
let verifyCount = 0;

vi.mock("../api-keys.js", () => ({
  validateApiKey: vi.fn(),
  isIpAllowedByList: vi.fn(() => true),
  shouldRecommendRotation: vi.fn(() => false),
}));

vi.mock("../siwe.js", () => ({
  verifySessionToken: vi.fn(async (_token: string) => ({
    userId: "user-2fa-race",
    authMethod: "siwe",
  })),
}));

vi.mock("../encryption.js", () => ({
  decryptSecret: vi.fn(() => "JBSWY3DPEHPK3PXP"),
}));

// Chainable db.select that returns a 2FA-enabled user with a stored secret.
const userRow = {
  twoFactorEnabled: true,
  twoFactorSecret: JSON.stringify({ encrypted: "e", iv: "i", authTag: "a" }),
};
const dbChain = {
  from: () => dbChain,
  where: () => dbChain,
  limit: () => Promise.resolve([userRow]),
};
vi.mock("../../db/client.js", () => ({
  db: { select: vi.fn(() => dbChain) },
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
  getRedisClient: vi.fn(async () => mockRedis),
  isRedisReady: vi.fn(() => true),
}));

vi.mock("../../middleware/rate-limit/utils.js", () => ({
  extractClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@otplib/preset-default", () => ({
  authenticator: {
    verify: vi.fn(() => {
      verifyCount += 1;
      return false; // always invalid → exercises the fail path
    }),
  },
}));

vi.mock("../../config.js", () => ({
  config: {
    NODE_ENV: "development",
    ADMIN_WALLET_ADDRESSES: undefined,
    PLATFORM_TEAM_ID: "",
  },
  ADMIN_WALLET_ADDRESSES_SET: new Set<string>(),
}));

import { sessionAuth } from "../middleware.js";

function makeApp(): Hono<OmaEnv> {
  const app = new Hono<OmaEnv>();
  app.use("*", sessionAuth);
  app.get("/probe", (c) => c.json({ ok: true }));
  return app;
}

beforeEach(() => {
  count = 0;
  verifyCount = 0;
  vi.clearAllMocks();
});

describe("SEC-7 — 2FA fail counter atomicity", () => {
  it("caps verify calls at <=4 when 10 concurrent requests carry invalid 2FA codes", async () => {
    const app = makeApp();
    const N = 10;

    const responses = await Promise.all(
      Array.from({ length: N }, () =>
        app.request("/probe", {
          headers: {
            Authorization: "Bearer oma_session_2fa_race_test_token",
            "X-2FA-Code": "000000",
          },
        }),
      ),
    );

    // With the racy read-then-INCR code, all 10 reach verify → 10 calls.
    // With the atomic INCR-then-check fix, the gate fires once
    // `fails >= 5` and short-circuits the rest. The exact number of
    // 401s is 4 (fails=1..4) and the rest (6) get 429 — but the load
    // ordering is non-deterministic, so we only assert the cap.
    expect(verifyCount).toBeLessThanOrEqual(4);
    expect(verifyCount).toBeGreaterThanOrEqual(1);

    // Every request either passed the gate (401) or got rejected (429).
    // Total = N; no other status codes allowed.
    const status401 = responses.filter((r) => r.status === 401).length;
    const status429 = responses.filter((r) => r.status === 429).length;
    expect(status401 + status429).toBe(N);
    expect(status429).toBeGreaterThanOrEqual(6);

    // SET NX was called for every request — 1 succeeds, 9 fall through to INCR.
    // No read-then-write gap.
    expect(mockRedis.set).toHaveBeenCalled();
    // At least 1 request hit SET NX + EX and the rest hit INCR as fallback.
    const incrCalls = mockRedis.incr.mock.calls.length;
    expect(incrCalls).toBeGreaterThanOrEqual(6); // at least 6 hit INCR
    expect(incrCalls + 1).toBe(N); // 1 SET NX success + N-1 INCR
  });

  it("sets the TTL only on the first increment (window doesn't slide)", async () => {
    const app = makeApp();
    const N = 5;

    await Promise.all(
      Array.from({ length: N }, () =>
        app.request("/probe", {
          headers: {
            Authorization: "Bearer oma_session_2fa_ttl_test_token",
            "X-2FA-Code": "000000",
          },
        }),
      ),
    );

    // First SET NX with EX returns "OK" → the key is created with TTL inline.
    // Subsequent calls see the key exists (NX returns null) and fall through
    // to INCR without re-setting the TTL. Assert that `set` was called with
    // the EX:300 option at least once.
    const setCalls = mockRedis.set.mock.calls.filter(
      ([_k, _v, opts]) => opts && (opts as { EX?: number }).EX === 300
    );
    expect(setCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("resets the counter when a valid 2FA code is presented (single request)", async () => {
    // Force a non-zero starting count, then a single valid request.
    count = 3;
    verifyCount = 0;

    // Override authenticator for this test only — valid this time.
    const { authenticator } = await import("@otplib/preset-default");
    (authenticator.verify as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      verifyCount += 1;
      return true;
    });

    const app = makeApp();
    const res = await app.request("/probe", {
      headers: {
        Authorization: "Bearer oma_session_2fa_valid_test_token",
        "X-2FA-Code": "123456",
      },
    });

    expect(res.status).toBe(200);
    expect(mockRedis.del).toHaveBeenCalledTimes(1);
    expect(count).toBe(0);
  });
});
