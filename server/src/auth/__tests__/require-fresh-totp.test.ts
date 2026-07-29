import { describe, it, expect, vi, beforeEach } from "vitest";

// Use the self-referential chain pattern that csrf-cookie.test.ts uses for
// Drizzle — every method returns `chain` so .select().from().where().limit()
// all work. The final .limit() resolves to whatever user(s) we want the
// query to return.
vi.mock("../../db/client.js", () => {
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
  return { db: chain };
});

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../two-factor.js", () => ({
  verifyTotpCode: vi.fn(),
  consumeBackupCode: vi.fn(),
  TwoFactorError: class TwoFactorError extends Error {
    constructor(public message: string, public code: string, public httpStatus: number) {
      super(message);
    }
  },
}));

import { requireFreshTotp } from "../require-fresh-totp.js";
import { db } from "../../db/client.js";
import { verifyTotpCode } from "../two-factor.js";
import type { Context } from "hono";
import type { Next } from "hono";

type MockUser = { twoFactorEnabled: boolean } | null;

function fakeCtx(
  userId: string | undefined,
  user: MockUser,
  path = "/v1/admin/ledger/sweep",
): Context {
  const headerStore = new Map<string, string>();
  return {
    req: {
      path,
      header: (name: string) => headerStore.get(name.toLowerCase()),
    },
    get: (key: string) => (key === "userId" ? userId : undefined),
    json: (body: unknown, status: number) => ({ status, body }),
    setHeader: (k: string, v: string) => headerStore.set(k.toLowerCase(), v),
  } as unknown as Context;
}

function setDbUser(user: MockUser) {
  // The middleware uses db.select(...).from(...).where(...).limit(1).
  // We only need to control what `.limit(1)` resolves to.
  const chain = db as unknown as { limit: ReturnType<typeof vi.fn> };
  chain.limit.mockResolvedValue(user ? [user] : []);
}

describe("requireFreshTotp({failClosed})", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects with 401 when no userId is set", async () => {
    const mw = requireFreshTotp({ failClosed: true });
    const ctx = fakeCtx(undefined, undefined);
    const next = vi.fn() as unknown as Next;
    const res = (await mw(ctx, next)) as { status: number; body: { error: { type: string } } };
    expect(res.status).toBe(401);
    expect(res.body.error.type).toBe("unauthorized");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects with 404 when user not in DB", async () => {
    setDbUser(null);
    const mw = requireFreshTotp({ failClosed: true });
    const ctx = fakeCtx("user-1", null);
    const next = vi.fn() as unknown as Next;
    const res = (await mw(ctx, next)) as { status: number; body: { error: { type: string } } };
    expect(res.status).toBe(404);
    expect(res.body.error.type).toBe("not_found");
    expect(next).not.toHaveBeenCalled();
  });

  it("failClosed=true rejects accounts WITHOUT 2FA with 403 2fa_enrollment_required", async () => {
    setDbUser({ twoFactorEnabled: false });
    const mw = requireFreshTotp({ failClosed: true });
    const ctx = fakeCtx("user-no-2fa", { twoFactorEnabled: false });
    const next = vi.fn() as unknown as Next;
    const res = (await mw(ctx, next)) as { status: number; body: { error: { code: string; type: string } } };
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("2fa_enrollment_required");
    expect(res.body.error.type).toBe("authentication_error");
    expect(next).not.toHaveBeenCalled();
  });

  it("failClosed=false (default) lets accounts WITHOUT 2FA pass through", async () => {
    setDbUser({ twoFactorEnabled: false });
    const mw = requireFreshTotp(); // default options
    const ctx = fakeCtx("user-no-2fa", { twoFactorEnabled: false });
    const next = vi.fn() as unknown as Next;
    const res = await mw(ctx, next);
    expect(res).toBeUndefined(); // no early response => passed through
    expect(next).toHaveBeenCalledOnce();
  });

  it("failClosed=false with explicit option also lets non-2FA pass through", async () => {
    setDbUser({ twoFactorEnabled: false });
    const mw = requireFreshTotp({ failClosed: false });
    const ctx = fakeCtx("user-no-2fa", { twoFactorEnabled: false });
    const next = vi.fn() as unknown as Next;
    const res = await mw(ctx, next);
    expect(res).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("2FA-enabled users without X-2FA-Code header get 401 2fa_required", async () => {
    setDbUser({ twoFactorEnabled: true });
    const mw = requireFreshTotp({ failClosed: true });
    const ctx = fakeCtx("user-with-2fa", { twoFactorEnabled: true });
    const next = vi.fn() as unknown as Next;
    const res = (await mw(ctx, next)) as { status: number; body: { error: { code: string } } };
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("2fa_required");
    expect(next).not.toHaveBeenCalled();
  });

  it("2FA-enabled users with valid TOTP code pass through (failClosed path)", async () => {
    setDbUser({ twoFactorEnabled: true });
    (verifyTotpCode as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const mw = requireFreshTotp({ failClosed: true });
    const ctx = fakeCtx("user-with-2fa", { twoFactorEnabled: true });
    ctx.setHeader("X-2FA-Code", "123456");
    const next = vi.fn() as unknown as Next;
    const res = await mw(ctx, next);
    expect(res).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
    expect(verifyTotpCode).toHaveBeenCalledWith("user-with-2fa", "123456");
  });
});