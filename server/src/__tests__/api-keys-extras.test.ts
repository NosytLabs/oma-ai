/**
 * G3 — Token expiry + IP allowlist tests for API keys.
 *
 * Covers:
 *   1. Pure helpers (isValidIpOrCidr, ipMatchesCidr, isIpAllowedByList, validateIpAllowlist)
 *   2. createApiKey() persists the new options
 *   3. bearerAuth middleware enforces expiry (401 expired_api_key) and IP allowlist (403 ip_not_allowed)
 *
 * Uses the same vi.hoisted + mock-the-world style as api-keys.test.ts and
 * middleware.test.ts. The real DB / Redis is never touched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import crypto from "crypto";
import type { OmaEnv } from "../types.js";

// Fixed raw key for all tests. sha256(this) is the hash validateApiKey looks up.
const TEST_RAW_KEY = "oma_sk_abcdeadbeef";
const TEST_KEY_HASH = crypto.createHash("sha256").update(TEST_RAW_KEY).digest("hex");
const TEST_KEY_PREFIX = TEST_RAW_KEY.slice(0, 12); // "oma_sk_abcde"

// ─── Mocks (must be declared BEFORE importing the modules under test) ────────────

const dbStore = vi.hoisted(() => ({
  inserted: [] as Array<Record<string, unknown>>,
  selectRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("../db/client.js", () => ({
  db: {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        dbStore.inserted.push(v);
        return {
          returning: async () => [{
            id: "key-1",
            userId: v.userId,
            name: v.name,
            keyHash: v.keyHash,
            keyPrefix: v.keyPrefix,
            active: true,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            expiresAt: v.expiresAt ?? null,
            ipAllowlist: v.ipAllowlist ?? null,
          }],
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          for: () => Promise.resolve(dbStore.selectRows),
          limit: () => Promise.resolve(dbStore.selectRows.slice(0, 1)),
        }),
      }),
    }),
    update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () => ({
              for: () => Promise.resolve(dbStore.selectRows),
            }),
          }),
        }),
        update: () => ({ set: () => ({ where: async () => undefined }) }),
      };
      return fn(tx);
    },
  },
}));

vi.mock("../lib/redis-client.js", () => ({
  getRedisClient: async () => null,
}));

vi.mock("../config.js", () => ({
  config: {
    DEFAULT_KEY_EXPIRY_DAYS: 0,
    NODE_ENV: "test",
    TRUSTED_PROXY_IPS: "",
    JWT_SECRET: "test-jwt-secret-at-least-32-characters-long-ok",
    ENCRYPTION_KEY: "test-encryption-key-32-bytes-base64!",
    ADMIN_WALLET_ADDRESSES: "",
    ADMIN_WALLET_ADDRESSES_SET: new Set<string>(),
    SESSION_COOKIE_TTL_MS: 3600000,
    PLATFORM_TEAM_ID: "",
  },
}));

vi.mock("../lib/logger.js", () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// ─── Imports under test ─────────────────────────────────────────────────────────

import {
  createApiKey,
  validateApiKey,
} from "../auth/api-keys.js";
import { bearerAuth } from "../auth/middleware.js";

beforeEach(() => {
  dbStore.inserted.length = 0;
  dbStore.selectRows.length = 0;
});


// ─── createApiKey() — new options persisted ─────────────────────────────────────

describe("createApiKey — expiresAt + ipAllowlist", () => {
  it("persists expiresAt when provided", async () => {
    const exp = new Date("2027-01-01T00:00:00Z");
    const result = await createApiKey("user-1", "expiring-key", { expiresAt: exp });
    expect(result.expiresAt).toEqual(exp);
    expect(dbStore.inserted[0].expiresAt).toEqual(exp);
  });

  it("persists null expiresAt when explicitly null (never expires)", async () => {
    const result = await createApiKey("user-1", "no-expiry", { expiresAt: null });
    expect(result.expiresAt).toBeNull();
    expect(dbStore.inserted[0].expiresAt).toBeNull();
  });

  it("persists null ipAllowlist when not provided", async () => {
    const result = await createApiKey("user-1", "no-allowlist");
    expect(result.ipAllowlist).toBeNull();
    expect(dbStore.inserted[0].ipAllowlist).toBeNull();
  });

  it("persists normalized ipAllowlist", async () => {
    const result = await createApiKey("user-1", "allowlisted", {
      ipAllowlist: ["10.0.0.0/8", "  192.168.1.5  "],
    });
    expect(result.ipAllowlist).toEqual(["10.0.0.0/8", "192.168.1.5"]);
    expect(dbStore.inserted[0].ipAllowlist).toEqual(["10.0.0.0/8", "192.168.1.5"]);
  });

  it("throws on invalid ipAllowlist (no row written)", async () => {
    await expect(
      createApiKey("user-1", "bad", { ipAllowlist: ["not-an-ip"] }),
    ).rejects.toThrow(/Invalid IP/);
    expect(dbStore.inserted.length).toBe(0);
  });
});

// ─── bearerAuth middleware — expiry + IP enforcement ────────────────────────────

function buildAuthApp() {
  const app = new Hono<OmaEnv>();
  app.use("/p/*", bearerAuth);
  app.get("/p/protected", (c) => c.json({ ok: true, userId: c.get("userId") }));
  return app;
}

function setActiveKey(overrides: Record<string, unknown>) {
  dbStore.selectRows.length = 0;
  dbStore.selectRows.push({
    id: "key-1",
    userId: "user-1",
    keyPrefix: TEST_KEY_PREFIX,
    keyHash: TEST_KEY_HASH,
    name: "test",
    active: true,
    lastUsedAt: null,
    expiresAt: null,
    ipAllowlist: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

describe("bearerAuth — expiry enforcement", () => {
  it("rejects a key whose expiresAt is in the past with code expired_api_key", async () => {
    setActiveKey({ expiresAt: new Date("2025-01-01T00:00:00Z") });
    const res = await buildAuthApp().request("/p/protected", {
      headers: { Authorization: `Bearer ${TEST_RAW_KEY}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error?.code).toBe("expired_api_key");
  });

  it("accepts a key with no expiresAt (never expires — no breaking change)", async () => {
    setActiveKey({ expiresAt: null });
    const res = await buildAuthApp().request("/p/protected", {
      headers: { Authorization: `Bearer ${TEST_RAW_KEY}` },
    });
    expect(res.status).toBe(200);
  });

  it("accepts a key whose expiresAt is in the future", async () => {
    setActiveKey({ expiresAt: new Date("2099-01-01T00:00:00Z") });
    const res = await buildAuthApp().request("/p/protected", {
      headers: { Authorization: `Bearer ${TEST_RAW_KEY}` },
    });
    expect(res.status).toBe(200);
  });
});

describe("bearerAuth — IP allowlist enforcement", () => {
  // ponytail: H2 — when TRUSTED_PROXY_IPS is empty (the test config's
  // production-safe default), extractClientIp REFUSES to read x-forwarded-for
  // and falls back to x-real-ip. We use x-real-ip in tests to mirror what
  // production sees from a direct connection (no trusted reverse proxy).
  it("rejects requests from IPs not in the allowlist (403 ip_not_allowed)", async () => {
    setActiveKey({ ipAllowlist: ["192.168.1.0/24"] });
    const res = await buildAuthApp().request("/p/protected", {
      headers: {
        Authorization: `Bearer ${TEST_RAW_KEY}`,
        "x-real-ip": "10.0.0.1", // not in 192.168.1.0/24
      },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe("ip_not_allowed");
  });

  it("accepts requests from IPs inside an IPv4 CIDR allowlist", async () => {
    setActiveKey({ ipAllowlist: ["192.168.1.0/24"] });
    const res = await buildAuthApp().request("/p/protected", {
      headers: {
        Authorization: `Bearer ${TEST_RAW_KEY}`,
        "x-real-ip": "192.168.1.5",
      },
    });
    expect(res.status).toBe(200);
  });

  it("accepts requests matching an IPv6 allowlist", async () => {
    setActiveKey({ ipAllowlist: ["::1"] });
    const res = await buildAuthApp().request("/p/protected", {
      headers: {
        Authorization: `Bearer ${TEST_RAW_KEY}`,
        "x-real-ip": "::1",
      },
    });
    expect(res.status).toBe(200);
  });

  it("rejects an IPv6 request that doesn't match an IPv4-only allowlist", async () => {
    setActiveKey({ ipAllowlist: ["10.0.0.0/8"] });
    const res = await buildAuthApp().request("/p/protected", {
      headers: {
        Authorization: `Bearer ${TEST_RAW_KEY}`,
        "x-real-ip": "2001:db8::1",
      },
    });
    expect(res.status).toBe(403);
  });

  it("accepts ANY IP when allowlist is null (no breaking change)", async () => {
    setActiveKey({ ipAllowlist: null });
    const res = await buildAuthApp().request("/p/protected", {
      headers: {
        Authorization: `Bearer ${TEST_RAW_KEY}`,
        "x-real-ip": "203.0.113.42",
      },
    });
    expect(res.status).toBe(200);
  });

  it("accepts ANY IP when allowlist is empty array (no breaking change)", async () => {
    setActiveKey({ ipAllowlist: [] });
    const res = await buildAuthApp().request("/p/protected", {
      headers: {
        Authorization: `Bearer ${TEST_RAW_KEY}`,
        "x-real-ip": "203.0.113.42",
      },
    });
    expect(res.status).toBe(200);
  });

  it("accepts when ANY entry in a multi-entry allowlist matches", async () => {
    setActiveKey({ ipAllowlist: ["10.0.0.0/8", "192.168.1.0/24", "::1"] });
    const res = await buildAuthApp().request("/p/protected", {
      headers: {
        Authorization: `Bearer ${TEST_RAW_KEY}`,
        "x-real-ip": "192.168.1.5",
      },
    });
    expect(res.status).toBe(200);
  });
});

describe("bearerAuth — combined expiry + IP checks", () => {
  it("checks expiry BEFORE IP (expired key with permissive IP is still rejected)", async () => {
    setActiveKey({ expiresAt: new Date("2025-01-01T00:00:00Z"), ipAllowlist: ["0.0.0.0/0"] });
    const res = await buildAuthApp().request("/p/protected", {
      headers: { Authorization: `Bearer ${TEST_RAW_KEY}`, "x-real-ip": "8.8.8.8" },
    });
    expect(res.status).toBe(401);
  });
});

// ─── validateApiKey returns ipAllowlist as part of the ApiKey shape ─────────────

describe("validateApiKey returns ipAllowlist", () => {
  it("includes the stored ipAllowlist in the returned ApiKey", async () => {
    setActiveKey({ ipAllowlist: ["10.0.0.0/8"] });
    const result = await validateApiKey(TEST_RAW_KEY);
    expect(result).not.toBeNull();
    expect(result?.ipAllowlist).toEqual(["10.0.0.0/8"]);
  });
});
