/**
	* Slice 6 — verify that the auth middleware rejects suspended users.
	*
	* The sessionAuth + bearerAuth middlewares both short-circuit with a
	* 403 + code "account_suspended" when the user row has either
	* `banned = true` (legacy Better Auth flag) OR `suspended = true`
	* (Slice 6 dedicated flag). These tests pin the contract so a future
	* change can't silently weaken suspension enforcement.
	*/
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock config + db before importing the middleware so the module-load
// config validation doesn't fight the test harness.
vi.mock("../../config.js", () => ({
		config: {
				NODE_ENV: "development",
				ADMIN_WALLET_ADDRESSES: "",
				ADMIN_WALLET_ADDRESSES_SET: new Set<string>(),
		},
}));

type MockDb = {
		select: ReturnType<typeof vi.fn>;
		insert: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
};

function buildMockDbWithUser(u: { banned?: boolean; suspended?: boolean } | null): MockDb {
		const rows = u ? [{ banned: !!u.banned, suspended: !!u.suspended }] : [];
		return {
				select: vi.fn().mockReturnValue({
						from: vi.fn().mockReturnValue({
								where: vi.fn().mockReturnValue({
										limit: vi.fn().mockResolvedValue(rows),
								}),
						}),
				}),
				insert: vi.fn(),
				update: vi.fn(),
		};
}

// Stub the auth + db modules the middleware depends on.
let mockDb: MockDb;
vi.mock("../../db/client.js", () => ({
		get db() {
				return mockDb;
		},
}));

vi.mock("../../auth.js", () => ({
		auth: {
				api: {
						getSession: vi.fn().mockResolvedValue(null),
				},
		},
}));

vi.mock("../../auth/api-keys.js", () => ({
	validateApiKey: vi.fn().mockResolvedValue({ id: "key-test", userId: "usr_test", active: true, expiresAt: null }),
	isIpAllowedByList: vi.fn().mockReturnValue(true),
	shouldRecommendRotation: vi.fn().mockReturnValue(false),
}));

import {
		sessionAuth,
		sessionOrBearerAuth,
		bearerAuth,
		optionalAuth,
} from "../../auth/middleware.js";

// Minimal Hono context stub. We only need .req (for header reads) and
// .json(...) (for short-circuit responses).
function makeCtx(opts: {
		sessionCookie?: string;
		bearerHeader?: string;
}): {
		req: {
				raw: { headers: Headers };
				header: (name: string) => string | undefined;
		};
		set: ReturnType<typeof vi.fn>;
		get: (k: string) => unknown;
		json: ReturnType<typeof vi.fn>;
		res: { headers: { set: ReturnType<typeof vi.fn> } };
} {
		const headers = new Headers();
		if (opts.sessionCookie) headers.set("cookie", opts.sessionCookie);
		if (opts.bearerHeader) headers.set("authorization", opts.bearerHeader);
		return {
				req: {
						raw: { headers },
						header: (name: string) => headers.get(name.toLowerCase()) ?? undefined,
				},
				set: vi.fn(),
				get: () => undefined,
				json: vi.fn().mockReturnValue(new Response("{}", { status: 200 })),
				res: { headers: { set: vi.fn() } },
		};
}

describe("auth middleware — suspension enforcement (Slice 6)", () => {
		beforeEach(() => {
				vi.clearAllMocks();
		});
		afterEach(() => {
				vi.restoreAllMocks();
		});

		it("sessionAuth returns 403 when user.suspended is true", async () => {
				mockDb = buildMockDbWithUser({ banned: false, suspended: true });
				// Override the auth.api.getSession mock for this test only.
				const { auth } = await import("../../auth.js");
				(auth.api.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
						user: { id: "usr_suspended" },
						session: { id: "sess_1" },
				});

				const ctx = makeCtx({ sessionCookie: "oma_session=abc" });
				const next = vi.fn();
				const result = await sessionAuth(ctx as unknown as Parameters<typeof sessionAuth>[0], next);

				// The middleware returned a Response (not undefined), meaning it short-
				// circuited before calling next(). Verify the JSON body has the
				// canonical suspended-account payload.
				expect(result).toBeDefined();
				expect(ctx.json).toHaveBeenCalledTimes(1);
				const [body, status] = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0];
				expect(status).toBe(403);
				expect(body).toMatchObject({
						error: {
								code: "account_suspended",
								type: "forbidden",
						},
				});
				expect(next).not.toHaveBeenCalled();
		});

		it("sessionAuth still rejects when only the legacy banned flag is set", async () => {
				mockDb = buildMockDbWithUser({ banned: true, suspended: false });
				const { auth } = await import("../../auth.js");
				(auth.api.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
						user: { id: "usr_banned" },
						session: { id: "sess_2" },
				});

				const ctx = makeCtx({ sessionCookie: "oma_session=abc" });
				const next = vi.fn();
				await sessionAuth(ctx as unknown as Parameters<typeof sessionAuth>[0], next);

				expect(ctx.json).toHaveBeenCalledTimes(1);
				const [, status] = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0];
				expect(status).toBe(403);
				expect(next).not.toHaveBeenCalled();
		});

		it("sessionAuth lets a non-suspended user through to next()", async () => {
				mockDb = buildMockDbWithUser({ banned: false, suspended: false });
				const { auth } = await import("../../auth.js");
				(auth.api.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
						user: { id: "usr_ok" },
						session: { id: "sess_3" },
				});

				const ctx = makeCtx({ sessionCookie: "oma_session=abc" });
				const next = vi.fn().mockResolvedValue(undefined);
				await sessionAuth(ctx as unknown as Parameters<typeof sessionAuth>[0], next);

				expect(ctx.json).not.toHaveBeenCalled();
				expect(next).toHaveBeenCalledTimes(1);
		});

		it("sessionOrBearerAuth returns 403 for a suspended session", async () => {
				mockDb = buildMockDbWithUser({ banned: false, suspended: true });
				const { auth } = await import("../../auth.js");
				(auth.api.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
						user: { id: "usr_suspended_mixed" },
						session: { id: "sess_mixed" },
				});

				const ctx = makeCtx({ sessionCookie: "oma_session=abc" });
				const next = vi.fn();
				const result = await sessionOrBearerAuth(
						ctx as unknown as Parameters<typeof sessionOrBearerAuth>[0],
						next,
				);

				expect(result).toBeDefined();
				expect(ctx.json).toHaveBeenCalledTimes(1);
				const [body, status] = (ctx.json as ReturnType<typeof vi.fn>).mock.calls[0];
				expect(status).toBe(403);
				expect(body).toMatchObject({
						error: { code: "account_suspended", type: "forbidden" },
				});
				expect(next).not.toHaveBeenCalled();
		});

		it("sessionOrBearerAuth lets a non-suspended session through", async () => {
				mockDb = buildMockDbWithUser({ banned: false, suspended: false });
				const { auth } = await import("../../auth.js");
				(auth.api.getSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
						user: { id: "usr_ok_mixed" },
						session: { id: "sess_mixed_ok" },
				});

				const ctx = makeCtx({ sessionCookie: "oma_session=abc" });
				const next = vi.fn().mockResolvedValue(undefined);
				await sessionOrBearerAuth(
						ctx as unknown as Parameters<typeof sessionOrBearerAuth>[0],
						next,
				);

				expect(ctx.json).not.toHaveBeenCalled();
				expect(next).toHaveBeenCalledTimes(1);
		});

		it("bearerAuth returns 403 when user.suspended is true", async () => {
				mockDb = buildMockDbWithUser({ banned: false, suspended: true });
				const ctx = makeCtx({ bearerHeader: "Bearer oma_sk_does_not_matter" });
				const next = vi.fn();
				const result = await bearerAuth(ctx as unknown as Parameters<typeof bearerAuth>[0], next);

				expect(result).toBeDefined();
				expect(ctx.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ code: "account_suspended" }) }), 403);
				expect(next).not.toHaveBeenCalled();
		});

		it("bearerAuth still rejects when only banned is true", async () => {
				mockDb = buildMockDbWithUser({ banned: true, suspended: false });
				const ctx = makeCtx({ bearerHeader: "Bearer oma_sk_x" });
				const next = vi.fn();
				await bearerAuth(ctx as unknown as Parameters<typeof bearerAuth>[0], next);

				expect(next).not.toHaveBeenCalled();
		});

		it.each([sessionAuth, sessionOrBearerAuth, optionalAuth])("rejects a session whose account no longer exists", async middleware => {
			mockDb = buildMockDbWithUser(null);
			const { auth } = await import("../../auth.js");
			vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: "deleted" }, session: { id: "stale" } } as never);
			const ctx = makeCtx({ sessionCookie: "oma_session=abc" });
			const next = vi.fn();
			await middleware(ctx as unknown as Parameters<typeof sessionAuth>[0], next);
			expect(ctx.json).toHaveBeenCalledWith(expect.anything(), 401);
			expect(next).not.toHaveBeenCalled();
		});

		it.each([sessionAuth, sessionOrBearerAuth, optionalAuth, bearerAuth])("blocks requests when account status cannot be verified", async middleware => {
			mockDb = buildMockDbWithUser(null);
			mockDb.select.mockImplementation(() => { throw new Error("private database diagnostic"); });
			const { auth } = await import("../../auth.js");
			vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: "active" }, session: { id: "session" } } as never);
			const ctx = makeCtx(middleware === bearerAuth ? { bearerHeader: "Bearer oma_sk_status_test" } : { sessionCookie: "oma_session=abc" });
			const next = vi.fn();
			await middleware(ctx as unknown as Parameters<typeof sessionAuth>[0], next);
			expect(ctx.json).toHaveBeenCalledWith({ error: { message: "Authentication temporarily unavailable", type: "server_error", code: "auth_state_unavailable" } }, 503);
			expect(next).not.toHaveBeenCalled();
		});

		it("never downgrades an invalid explicit API key to guest access", async () => {
			const { validateApiKey } = await import("../../auth/api-keys.js");
			vi.mocked(validateApiKey).mockResolvedValueOnce(null);
			const ctx = makeCtx({ bearerHeader: "Bearer oma_sk_revoked" });
			const next = vi.fn();
			await optionalAuth(ctx as unknown as Parameters<typeof optionalAuth>[0], next);
			expect(ctx.json).toHaveBeenCalledWith(expect.anything(), 401);
			expect(next).not.toHaveBeenCalled();
		});
});
