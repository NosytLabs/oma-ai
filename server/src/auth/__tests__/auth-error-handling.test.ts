/**
 * Regression test — auth middleware must not return HTTP 500 when an
 * internal auth-validation call throws.
 *
 * Bug:  POST /v1/chat/completions with `Authorization: Bearer invalid-key-12345`
 *       returned 500 `{"error":{"message":"Internal server error", ...}}` instead
 *       of 401 `{"error":{"message":"Invalid API key", ...}}`.
 *
 * Cause: `validateApiKey` does DB + Redis I/O. A failure (e.g. DB connection
 *        blip on a request with a never-seen key) throws. `bearerAuth` had
 *        no try/catch around it, so the error propagated to Hono's default
 *        error handler → 500. `optionalAuth`, `requireAdmin`, and
 *        `requireTeamRole` had the same shape.
 *
 * Fix:  wrap each async call in try/catch. For auth-validation calls
 *       (`validateApiKey`, `verifySessionToken`) treat a throw as a failed
 *       auth attempt → 401 with a generic "Invalid API key" message and
 *       log the real cause server-side. For DB queries inside
 *       `requireAdmin` / `requireTeamRole` (not auth-validation — already
 *       authenticated), a throw is a real server failure → 500.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { OmaEnv } from "../../types.js";

vi.mock("../api-keys.js", () => ({
  validateApiKey: vi.fn(),
  isIpAllowedByList: vi.fn(() => true),
  shouldRecommendRotation: vi.fn(() => false),
}));

vi.mock("../siwe.js", () => ({
  verifySessionToken: vi.fn(),
}));

vi.mock("../encryption.js", () => ({
  decryptSecret: vi.fn(),
}));

const dbSelect = vi.fn();
vi.mock("../../db/client.js", () => ({
  db: {
    select: (...args: unknown[]) => dbSelect(...args),
    insert: vi.fn(),
    update: vi.fn(),
  },
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

import { bearerAuth, optionalAuth, requireAdmin, requireTeamRole } from "../middleware.js";
import { validateApiKey } from "../api-keys.js";
import { verifySessionToken } from "../siwe.js";

const mockedValidate = validateApiKey as unknown as ReturnType<typeof vi.fn>;
const mockedVerifySession = verifySessionToken as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  dbSelect.mockReset();
});

describe("bearerAuth — internal auth-validation errors must be 401, not 500", () => {
  function makeApp(): Hono<OmaEnv> {
    const app = new Hono<OmaEnv>();
    app.use("*", bearerAuth);
    app.get("/probe", (c) => c.json({ ok: true }));
    return app;
  }

  it("returns 401 (not 500) when validateApiKey throws", async () => {
    mockedValidate.mockRejectedValueOnce(new Error("DB connection lost"));
    const app = makeApp();
    const res = await app.request("/probe", {
      headers: { Authorization: "Bearer oma_sk_will_throw_00000000000000000000" },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { message: string; type: string } };
    expect(body.error.type).toBe("authentication_error");
    // The body must not leak the internal error message.
    expect(body.error.message).toBe("Invalid API key");
    expect(body.error.message).not.toMatch(/DB connection/);
  });

  it("returns 401 when validateApiKey returns null (existing behavior preserved)", async () => {
    mockedValidate.mockResolvedValueOnce(null);
    const app = makeApp();
    const res = await app.request("/probe", {
      headers: { Authorization: "Bearer oma_sk_unknown_0000000000000000000000" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header is missing (no async call)", async () => {
    const app = makeApp();
    const res = await app.request("/probe");
    expect(res.status).toBe(401);
    expect(mockedValidate).not.toHaveBeenCalled();
  });
});

describe("sessionAuth — internal JWT verification errors must be 401, not 500", () => {
  // sessionAuth is already safe because verifySessionToken swallows errors
  // and returns null. This test pins that contract.
  it("returns 401 (not 500) when verifySessionToken throws", async () => {
    const { sessionAuth } = await import("../middleware.js");
    mockedVerifySession.mockRejectedValueOnce(new Error("jose: malformed JWT"));

    const app = new Hono<OmaEnv>();
    app.use("*", sessionAuth);
    app.get("/probe", (c) => c.json({ ok: true }));

    const res = await app.request("/probe", {
      headers: { Authorization: "Bearer will-throw" },
    });
    expect(res.status).toBe(401);
  });
});

describe("optionalAuth — internal auth-validation errors must not 500 the request", () => {
  function makeApp(): Hono<OmaEnv> {
    const app = new Hono<OmaEnv>();
    app.use("*", optionalAuth);
    app.get("/probe", (c) => {
      const uid = c.get("userId");
      return c.json({ ok: true, userId: uid ?? null });
    });
    return app;
  }

  it("treats a thrown validateApiKey as anonymous (no 500, no userId)", async () => {
    mockedValidate.mockRejectedValueOnce(new Error("redis: connection refused"));
    const app = makeApp();
    const res = await app.request("/probe", {
      headers: { Authorization: "Bearer oma_sk_throw_00000000000000000000000" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; userId: string | null };
    expect(body.ok).toBe(true);
    expect(body.userId).toBeNull();
  });

  it("treats a null validateApiKey as anonymous (existing behavior preserved)", async () => {
    mockedValidate.mockResolvedValueOnce(null);
    const app = makeApp();
    const res = await app.request("/probe", {
      headers: { Authorization: "Bearer oma_sk_unknown_00000000000000000000" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string | null };
    expect(body.userId).toBeNull();
  });
});

describe("requireAdmin / requireTeamRole — DB errors are real 500s (not auth failures)", () => {
  it("requireAdmin returns 500 when the team-membership DB lookup throws (callers are already authenticated)", async () => {
    // The admin lookup is not an auth-validation step — the user is
    // already authenticated. A throw here is a server error.
    // Skip the wallet-admin branch (set is empty) and force the
    // team-membership SELECT to reject.
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: () => Promise.reject(new Error("DB is down")),
    };
    dbSelect.mockReturnValueOnce(chain);

    const app = new Hono<OmaEnv>();
    app.use("*", async (c, next) => {
      c.set("userId", "user-already-authed");
      await next();
    });
    app.use("*", requireAdmin());
    app.get("/probe", (c) => c.json({ ok: true }));

    const res = await app.request("/probe?teamId=team-xyz");
    expect(res.status).toBe(500);
  });

  it("requireTeamRole returns 500 when the team-membership DB lookup throws", async () => {
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: () => Promise.reject(new Error("DB is down")),
    };
    dbSelect.mockReturnValueOnce(chain);

    const app = new Hono<OmaEnv>();
    app.use("*", async (c, next) => {
      c.set("userId", "user-already-authed");
      await next();
    });
    app.use("*", requireTeamRole("admin"));
    app.get("/probe", (c) => c.json({ ok: true }));

    const res = await app.request("/probe?teamId=team-xyz");
    expect(res.status).toBe(500);
  });
});
