/**
 * C1 — Regression test: csrf_token cookie must NOT be HttpOnly.
 *
 * The double-submit CSRF pattern requires the browser-side JS to read the
 * cookie value and echo it in the `x-csrf-token` header on state-changing
 * requests. If the cookie is HttpOnly the browser silently drops the
 * `Set-Cookie` (it cannot be assigned via document.cookie), the client
 * never sees the token, and every state-changing request 403's with
 * `csrf_validation_failed`.
 *
 * CSRF defense-in-depth is preserved by:
 *   - SameSite=Strict  (cookie NOT sent on cross-site navigations)
 *   - Secure (prod)    (over HTTPS only, blocks MITM cookie theft)
 *   - HMAC-signed body (validateCsrfToken rejects forged cookies)
 *
 * This test pins the wire-format behavior so future refactors cannot
 * re-introduce HttpOnly and silently break account-number login.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@hono/node-server", () => ({ serve: vi.fn() }));

vi.mock("../db/client.js", () => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn(async () => []);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn(async () => []);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
    }),
  );
  return { db: chain, getDb: () => chain };
});

vi.mock("../auth/api-keys.js", () => ({
  validateApiKey: vi.fn(),
  createApiKey: vi.fn(),
  listApiKeys: vi.fn().mockResolvedValue([]),
  revokeApiKey: vi.fn(),
}));

vi.mock("../auth/siwe.js", () => ({
  verifySiweMessage: vi.fn(),
  getOrCreateUser: vi.fn(),
  getNonce: vi.fn(),
  generateSessionToken: vi.fn().mockReturnValue("session.token.value"),
  verifySessionToken: vi.fn(),
}));

vi.mock("../credits/index.js", () => ({
  getBalance: vi.fn(),
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  addCredits: vi.fn(),
}));

vi.mock("../credits/deposit.js", () => ({
  processUsdcDeposit: vi.fn(),
}));

vi.mock("../credits/oracle.js", () => ({
  getOmaUsdPrice: vi.fn().mockResolvedValue(0.10),
}));

vi.mock("../inference/circuit-breaker.js", () => ({
  checkCircuitBreaker: vi.fn(),
  checkOracleCircuitBreaker: vi.fn(),
}));

vi.mock("../inference/router.js", () => ({ handleChatCompletion: vi.fn() }));
vi.mock("../inference/venice.js", () => ({ veniceChatCompletion: vi.fn() }));

vi.mock("../inference/provider-health.js", () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reportProviderResult: vi.fn(),
  stopBackgroundDbSync: vi.fn(),
  stopBackgroundProbing: vi.fn(),
  stopCacheCleanup: vi.fn(),
}));

vi.mock("../middleware/rate-limit.js", () => ({
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
  tokenBucket: () => async (_c: unknown, next: () => Promise<void>) => next(),
  modelRateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
  burstRateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
  expressiveRateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../middleware/rate-limit/utils.js", () => ({
  extractClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("../lib/redis-client.js", () => ({
  getRedisClient: vi.fn(async () => ({
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    ttl: vi.fn(async () => 60),
  })),
  isRedisReady: vi.fn(() => true),
}));

vi.mock("../auth/two-factor.js", () => ({
  setupTwoFactor: vi.fn(),
  enableTwoFactor: vi.fn(),
  disableTwoFactor: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  getTwoFactorStatus: vi.fn(),
  getBackupCodeCount: vi.fn().mockResolvedValue(0),
  verifyTotpCode: vi.fn(),
  consumeBackupCode: vi.fn(),
  TwoFactorError: class TwoFactorError extends Error {
    constructor(message: string, public readonly code: string, public readonly httpStatus: number = 400) {
      super(message);
      this.name = "TwoFactorError";
    }
  },
}));

vi.mock("../auth/require-fresh-totp.js", () => ({
  requireFreshTotp: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../auth/wallet-link.js", () => ({
  unlinkWallet: vi.fn(),
  WalletLinkError: class WalletLinkError extends Error {
    constructor(message: string, public readonly code: string, public readonly httpStatus: number = 400) {
      super(message);
      this.name = "WalletLinkError";
    }
  },
}));

vi.mock("../x402/facilitator.js", () => {
  const { Hono } = require("hono") as typeof import("hono");
  return { x402Routes: new Hono() };
});

vi.mock("../config.js", () => ({
  config: {
    PORT: 3001,
    CORS_ORIGIN: "http://localhost:3000",
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars",
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://localhost:5432/oma_test",
    REDIS_URL: "redis://localhost:6379",
    HOUDINI_WEBHOOK_SECRET: "test-webhook-secret",
    CSRF_SECRET: "test-csrf-secret-that-is-32-chars-long-yes",
    SESSION_COOKIE_TTL_MS: 60 * 60 * 1000,
  },
}));

import app from "../index.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("C1 — csrf_token cookie must NOT be HttpOnly (double-submit pattern)", () => {
  it("POST /auth/csrf-token emits a Set-Cookie header that is JS-readable", async () => {
    const res = await app.request("/auth/csrf-token", { method: "POST" });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("token");
    expect(typeof body.token).toBe("string");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).not.toBeNull();
    expect(setCookie).toMatch(/^csrf_token=/);

    // C1 fix: no HttpOnly — the client reads this cookie via document.cookie
    // and echoes it in the x-csrf-token header on state-changing requests.
    // If HttpOnly is ever re-added, every account-number login 403's with
    // csrf_validation_failed because document.cookie returns "".
    expect(setCookie).not.toMatch(/HttpOnly/i);

    // SameSite=Strict is the actual CSRF defense for cross-site requests.
    expect(setCookie).toMatch(/SameSite=Strict/);

    // path=/ so every route sees the cookie.
    expect(setCookie).toMatch(/path=\//);
  });

  it("POST /auth/account/login double-submit succeeds when header matches cookie", async () => {
    // Step 1: fetch a CSRF token + cookie pair.
    const csrfRes = await app.request("/auth/csrf-token", { method: "POST" });
    expect(csrfRes.status).toBe(200);
    const csrfBody = await csrfRes.json();
    const token = csrfBody.token as string;

    // Mirror what the browser does: parse the Set-Cookie value out and put it
    // in the Cookie header on subsequent requests. This is the exact shape
    // document.cookie + credentials: 'include' would produce.
    const setCookie = csrfRes.headers.get("set-cookie") || "";
    const cookieValue = setCookie.split(";")[0];
    expect(cookieValue).toMatch(/^csrf_token=/);

    // Step 2: POST /auth/account/login with matching cookie + header.
    // We don't have a DB user to actually log in, so the route will return
    // either 200 (no user) or 401/500, but it MUST NOT 403 with
    // csrf_validation_failed. A 403 here means our fix regressed.
    const loginRes = await app.request("/auth/account/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieValue,
        "x-csrf-token": token,
      },
      body: JSON.stringify({ accountNumber: "1234567890123456" }),
    });

    // 403 here would mean csrf validation failed → regression.
    if (loginRes.status === 403) {
      const body = await loginRes.json().catch(() => ({}));
      expect(body.error?.code).not.toBe("csrf_validation_failed");
    }

    // For proof the test ran the full route, the status should be one of:
    //   500  (mocked db returned [] — user not found in this isolated env)
    //   401  (auth check)
    //   200  (would be a real success in a live env)
    // Anything else, especially 403 with csrf_validation_failed, is a regression.
    expect([200, 401, 500]).toContain(loginRes.status);
  });

  it("POST /auth/account/login rejects mismatched CSRF header/cookie with 403", async () => {
    const csrfRes = await app.request("/auth/csrf-token", { method: "POST" });
    const setCookie = csrfRes.headers.get("set-cookie") || "";
    const cookieValue = setCookie.split(";")[0];

    // Forge a different x-csrf-token header while sending the real cookie.
    const res = await app.request("/auth/account/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieValue,
        "x-csrf-token": "forged-token-not-matching-cookie",
      },
      body: JSON.stringify({ accountNumber: "1234567890123456" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("csrf_validation_failed");
  });

  it("POST /auth/account/login rejects missing x-csrf-token header with 403", async () => {
    const csrfRes = await app.request("/auth/csrf-token", { method: "POST" });
    const setCookie = csrfRes.headers.get("set-cookie") || "";
    const cookieValue = setCookie.split(";")[0];

    const res = await app.request("/auth/account/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieValue,
      },
      body: JSON.stringify({ accountNumber: "1234567890123456" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("csrf_validation_failed");
  });
});
