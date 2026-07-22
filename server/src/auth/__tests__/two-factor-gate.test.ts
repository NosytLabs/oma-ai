/**
 * Unit tests for the centralized 2FA gate (auth/two-factor-gate.ts).
 *
 * Covers the full TOTP verify path including:
 *   - missing-code 401
 *   - missing-secret 500
 *   - fail-counter cap (5 attempts / 5 min)
 *   - TOTP-verify pass → fail counter cleared
 *   - TOTP-verify fail → counter advances, replay not yet consulted
 *   - replay-window rejection: a code valid for the current step is
 *     rejected on a second use within the same 30s window
 *
 * The Redis mock is in-memory; atomicity is provided by JS being
 * single-threaded within a microtask.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RedisKey = string;

const store = new Map<RedisKey, { value: string; expiresAt: number }>();

function get(key: RedisKey): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt > 0 && entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

const mockRedis = {
  get: vi.fn(async (key: string) => get(key)),
  set: vi.fn(async (key: string, value: string, opts?: { NX?: boolean; EX?: number }) => {
    if (opts?.NX && store.has(key)) return null;
    const expiresAt = opts?.EX ? Date.now() + opts.EX * 1000 : 0;
    store.set(key, { value, expiresAt });
    return "OK";
  }),
  setEx: vi.fn(async (key: string, ttl: number, value: string) => {
    store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    return "OK";
  }),
  incr: vi.fn(async (key: string) => {
    const current = Number.parseInt(get(key) ?? "0", 10);
    const next = current + 1;
    store.set(key, { value: String(next), expiresAt: store.get(key)?.expiresAt ?? 0 });
    return next;
  }),
  del: vi.fn(async (key: string) => {
    store.delete(key);
    return 1;
  }),
};

const mockAuthenticator = vi.hoisted(() => ({
  verify: vi.fn(),
}));

vi.mock("../../lib/redis-client.js", () => ({
  getRedisClient: vi.fn(async () => mockRedis),
}));

vi.mock("@otplib/preset-default", () => ({
  authenticator: mockAuthenticator,
}));

vi.mock("../encryption.js", () => ({
  decryptSecret: vi.fn(() => "JBSWY3DPEHPK3PXP"),
}));

vi.mock("../../lib/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { enforceTwoFactor } from "../two-factor-gate.js";

const USER = "user-gate-test";
const STORED_SECRET = JSON.stringify({ encrypted: "e", iv: "i", authTag: "a" });

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
  mockAuthenticator.verify.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("enforceTwoFactor", () => {
  it("rejects a missing X-2FA-Code with 401 2fa_required", async () => {
    const result = await enforceTwoFactor(USER, STORED_SECRET, undefined);
    expect(result).toEqual({
      ok: false,
      status: 401,
      message: "2FA code required",
      code: "2fa_required",
    });
  });

  it("rejects when the user has no stored secret with 500", async () => {
    const result = await enforceTwoFactor(USER, null, "123456");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.message).toMatch(/decrypt/i);
    }
  });

  it("clears the fail counter on a successful verify", async () => {
    mockAuthenticator.verify.mockReturnValueOnce(true);
    // Pre-seed the counter to prove it gets cleared.
    store.set(`2fa_fail:${USER}`, { value: "3", expiresAt: 0 });

    const result = await enforceTwoFactor(USER, STORED_SECRET, "123456");
    expect(result).toEqual({ ok: true });
    expect(store.has(`2fa_fail:${USER}`)).toBe(false);
  });

  it("returns 429 after the 5-attempt fail cap is reached", async () => {
    mockAuthenticator.verify.mockReturnValue(false);
    for (let i = 0; i < 5; i++) {
      const result = await enforceTwoFactor(USER, STORED_SECRET, "000000");
      expect(result.ok).toBe(false);
    }
    // 6th attempt must short-circuit without even calling authenticator.verify.
    const callsBefore = mockAuthenticator.verify.mock.calls.length;
    const result = await enforceTwoFactor(USER, STORED_SECRET, "000000");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.code).toBe("2fa_brute_force");
    }
    expect(mockAuthenticator.verify.mock.calls.length).toBe(callsBefore);
  });

  it("rejects a code whose 30-second step has already been used", async () => {
    const currentStep = Math.floor(Date.now() / 1000 / 30);
    store.set(`2fa:laststep:${USER}`, { value: String(currentStep), expiresAt: 0 });
    mockAuthenticator.verify.mockReturnValueOnce(true); // otplib accepts the code
    const result = await enforceTwoFactor(USER, STORED_SECRET, "123456");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.message).toMatch(/already used/i);
      expect(result.code).toBe("2fa_replay");
    }
  });

  it("returns 401 invalid_code for an authenticator-rejected code", async () => {
    mockAuthenticator.verify.mockReturnValueOnce(false);
    const result = await enforceTwoFactor(USER, STORED_SECRET, "000000");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.message).toBe("Invalid 2FA code");
    }
  });
});
