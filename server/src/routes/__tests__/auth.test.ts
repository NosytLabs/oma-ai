/**
 * Integration tests for the auth route handler (auth.ts).
 *
 * Covers the user-facing endpoints that were previously only tested via
 * standalone browser scripts:
 *   GET    /user               — current user lookup (auth + unauth)
 *   GET    /sessions           — active session list
 *   DELETE /sessions/:id       — revoke a specific session (validation + guard)
 *   DELETE /sessions           — revoke all other sessions
 *   GET    /v1/keys            — list API keys
 *   POST   /v1/keys            — create API key (validation + audit)
 *   DELETE /v1/keys/:id       — revoke API key (found + not-found)
 *   DELETE /v1/history         — wipe usage history
 *   POST   /v1/keys/install    — install API key cookie (validation)
 *   POST   /v1/keys/logout     — clear API key cookie
 *   DELETE /account            — account deletion (auth + audit)
 *
 * Auth middleware, Better Auth, DB, audit logger, and rate-limit are mocked.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { DrizzleQueryError } from "drizzle-orm/errors";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../middleware/rate-limit.js", () => ({
	rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../../middleware/audit.js", () => ({
	auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/logger.js", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

// Better Auth mock — getSession returns a session when a Cookie header is present.
// `authBaseURL` is exported by the real module and is read at import time by
// routes/auth.ts to bind an attach-wallet message to our own origin, so the
// mock must supply it or the route module throws while evaluating.
const mockAuthApi = vi.hoisted(() => ({
	getSession: vi.fn(),
}));
vi.mock("../../auth.js", async () => {
	const { getCookies } = await import("better-auth/cookies");
	return {
		auth: {
			api: mockAuthApi,
			$context: Promise.resolve({ authCookies: getCookies({
				baseURL: "https://www.oma-ai.com",
				advanced: { cookiePrefix: "oma", useSecureCookies: true, crossSubDomainCookies: { enabled: true, domain: "www.oma-ai.com" } },
			}) }),
		},
		authBaseURL: "http://localhost:3000",
	};
});

// Auth middleware mock — sessionAuth sets userId/session/user when authorised.
vi.mock("../../auth/middleware.js", () => ({
	sessionAuth: async (c: { req: { header: (n: string) => string | undefined }; set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
		const cookie = c.req.header("Cookie");
		if (!cookie || !cookie.includes("session=")) {
			return new Response(JSON.stringify({ error: { message: "Unauthorized", type: "authentication_error" } }), { status: 401, headers: { "Content-Type": "application/json" } });
		}
		c.set("userId", "user_1");
		c.set("session", { id: "sess_current", userId: "user_1" });
		c.set("user", { id: "user_1", email: "test@example.com" });
		await next();
	},
}));

// API key helpers mock
const mockCreateApiKey = vi.hoisted(() => vi.fn());
const mockListApiKeys = vi.hoisted(() => vi.fn());
const mockRevokeApiKey = vi.hoisted(() => vi.fn());
const mockValidateApiKey = vi.hoisted(() => vi.fn());
vi.mock("../../auth/api-keys.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../auth/api-keys.js")>()),
	createApiKey: mockCreateApiKey,
	listApiKeys: mockListApiKeys,
	revokeApiKey: mockRevokeApiKey,
	validateApiKey: mockValidateApiKey,
	createApiKeyCookieHeader: vi.fn(() => "oma_api_key=test; HttpOnly; Path=/; Max-Age=604800"),
	createLogoutCookieHeader: vi.fn(() => "oma_api_key=; HttpOnly; Path=/; Max-Age=0"),
}));

// DB mock
const mockDb = vi.hoisted(() => {
	const chain = () => {
		const self: any = {
			from: vi.fn(() => self),
			where: vi.fn(() => self),
			orderBy: vi.fn(() => self),
			limit: vi.fn(() => self),
			values: vi.fn(() => self),
			returning: vi.fn(() => self),
		};
		return self;
	};
	return {
		select: vi.fn(() => chain()),
		delete: vi.fn(() => chain()),
		insert: vi.fn(() => chain()),
	};
});
vi.mock("../../db/client.js", () => ({ db: mockDb }));

vi.mock("../../db/schema.js", () => ({
	user: { id: "id" },
	session: { id: "id", userId: "userId", expiresAt: "expiresAt", createdAt: "createdAt", userAgent: "userAgent", ipAddress: "ipAddress" },
	usageRecords: { userId: "userId" },
	auditLogs: { userId: "userId" },
}));

import { authRoutes } from "../auth.js";
import { auditLog } from "../../middleware/audit.js";
import { logger } from "../../lib/logger.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function authReq(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
	const app = new Hono();
	app.route("/", authRoutes);
	return app.request(
		new Request(`http://localhost${path}`, {
			method: method.toUpperCase(),
			headers: { "Content-Type": "application/json", ...headers },
			body: body ? JSON.stringify(body) : undefined,
		}),
	);
}

const authedHeaders = { Cookie: "session=abc123" };

beforeEach(() => {
	vi.clearAllMocks();
	mockAuthApi.getSession.mockResolvedValue(null);
	mockListApiKeys.mockResolvedValue([]);
	mockRevokeApiKey.mockResolvedValue(null);
	mockValidateApiKey.mockResolvedValue({
		id: "key_1",
		userId: "user_1",
		active: true,
		expiresAt: null,
	});
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("auth routes", () => {
	describe("GET /user", () => {
		it("returns 401 when no session", async () => {
			const res = await authReq("get", "/user");
			expect(res.status).toBe(401);
		});

		it("returns user info when authenticated", async () => {
			mockAuthApi.getSession.mockResolvedValueOnce({
				user: { id: "u1", email: "a@b.com", name: "A", evmAddress: null, isAnonymous: false, createdAt: new Date() },
				session: { id: "s1" },
			});
			const res = await authReq("get", "/user", undefined, authedHeaders);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.id).toBe("u1");
			expect(data.email).toBe("a@b.com");
		});
	});

	describe.each([["get", "/user"], ["delete", "/account"]])("session store outage on %s %s", (method, path) => {
		it("returns a retryable JSON error without running account mutations", async () => {
			mockAuthApi.getSession.mockRejectedValueOnce(new Error("session store disconnected"));
			const response = await authReq(method, path, undefined, authedHeaders);
			expect(response.status).toBe(503);
			expect(await response.json()).toMatchObject({ error: { code: "auth_validation_unavailable", type: "service_unavailable" } });
			expect(mockDb.delete).not.toHaveBeenCalled();
			expect(auditLog).not.toHaveBeenCalled();
		});
	});

	describe("GET /sessions", () => {
		it("returns 401 when no session cookie", async () => {
			const res = await authReq("get", "/sessions");
			expect(res.status).toBe(401);
		});

		it("returns active sessions with isCurrent flag", async () => {
			mockDb.select.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn().mockResolvedValue([
							{ id: "sess_current", createdAt: new Date(), expiresAt: new Date("2027-01-01"), userAgent: "Mozilla", ipAddress: "1.2.3.4" },
							{ id: "sess_other", createdAt: new Date(), expiresAt: new Date("2027-01-01"), userAgent: "curl", ipAddress: "5.6.7.8" },
						]),
					})),
				})),
			});
			const res = await authReq("get", "/sessions", undefined, authedHeaders);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.sessions).toHaveLength(2);
			expect(data.sessions[0].isCurrent).toBe(true);
			expect(data.sessions[1].isCurrent).toBe(false);
		});
	});

	describe("DELETE /sessions/:id", () => {
		it("rejects invalid session id with 400", async () => {
			const res = await authReq("delete", "/sessions/bad!id", undefined, authedHeaders);
			expect(res.status).toBe(400);
		});

		it("rejects revoking the current session with 400", async () => {
			const res = await authReq("delete", "/sessions/sess_current", undefined, authedHeaders);
			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.error.message).toContain("Cannot revoke the current session");
		});

		it("returns 404 when session does not exist", async () => {
			mockDb.delete.mockReturnValueOnce({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([]),
				})),
			});
			const res = await authReq("delete", "/sessions/sess_other", undefined, authedHeaders);
			expect(res.status).toBe(404);
		});

		it("revokes a remote session and writes audit log", async () => {
			mockDb.delete.mockReturnValueOnce({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([{ id: "sess_other" }]),
				})),
			});
			const res = await authReq("delete", "/sessions/sess_other", undefined, authedHeaders);
			expect(res.status).toBe(200);
			expect(auditLog).toHaveBeenCalledWith(
				expect.objectContaining({ action: "USER_LOGOUT", resourceId: "sess_other" }),
			);
		});
	});

	describe("DELETE /sessions (revoke all others)", () => {
		it("revokes all non-current sessions and returns count", async () => {
			mockDb.select.mockReturnValueOnce({
				from: vi.fn(() => ({
					where: vi.fn().mockResolvedValue([
						{ id: "sess_current" },
						{ id: "sess_a" },
						{ id: "sess_b" },
					]),
				})),
			});
			mockDb.delete.mockReturnValue({
				where: vi.fn(() => ({})),
			});
			const res = await authReq("delete", "/sessions", undefined, authedHeaders);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.revokedCount).toBe(2);
		});
	});

	describe("GET /v1/keys", () => {
		it("returns empty list when no keys", async () => {
			mockListApiKeys.mockResolvedValueOnce([]);
			const res = await authReq("get", "/v1/keys", undefined, authedHeaders);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.keys).toEqual([]);
		});

		it("returns active keys", async () => {
			mockListApiKeys.mockResolvedValueOnce([
				{ id: "key_1", name: "default", keyPrefix: "oma_sk_abc", createdAt: new Date(), lastUsedAt: null },
			]);
			const res = await authReq("get", "/v1/keys", undefined, authedHeaders);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.keys).toHaveLength(1);
			expect(data.keys[0].prefix).toBe("oma_sk_abc");
		});
	});

	describe("POST /v1/keys", () => {
		it("persists normalized IP restrictions and includes them in key metadata", async () => {
			mockCreateApiKey.mockImplementationOnce(async (_user, name, options) => ({ id: "key_ip", name, prefix: "oma_sk_prefix", rawKey: "oma_sk_secret", createdAt: new Date(), ...options }));
			const res = await authReq("post", "/v1/keys", { name: "Server only", ipAllowlist: [" 192.0.2.0/24 ", "192.0.2.0/24", "2001:db8::1"] }, authedHeaders);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.ipAllowlist).toEqual(["192.0.2.0/24", "2001:db8::1"]);
			expect(mockCreateApiKey).toHaveBeenCalledWith("user_1", "Server only", { ipAllowlist: data.ipAllowlist });
			mockListApiKeys.mockResolvedValueOnce([{ ...data, keyPrefix: data.prefix, createdAt: new Date(), lastUsedAt: null }]);
			const listing = await authReq("get", "/v1/keys", undefined, authedHeaders);
			expect((await listing.json()).keys[0].ipAllowlist).toEqual(data.ipAllowlist);
		});

		it.each([[], ["not-an-ip"], ["192.0.2.0/33"], ["::/129"], ["::/bad"], ["::1%eth0"], Array(21).fill("192.0.2.1")].map(ipAllowlist => ({ ipAllowlist })))("rejects invalid IP restrictions %j without creating a credential", async ({ ipAllowlist }) => {
			expect((await authReq("post", "/v1/keys", { ipAllowlist }, authedHeaders)).status).toBe(400);
			expect(mockCreateApiKey).not.toHaveBeenCalled();
		});

		it("applies bounded expiry and deduplicated model restrictions", async () => {
			const now = Date.now();
			mockCreateApiKey.mockImplementationOnce(async (_user, name, options) => ({ id: "key_scoped", name, prefix: "oma_sk_prefix", rawKey: "oma_sk_secret", createdAt: new Date(), ...options }));
			const res = await authReq("post", "/v1/keys", { name: "  Coding  ", expiresInDays: 7, allowedModels: [" minimax-m2-7 ", "minimax-m2-7"] }, authedHeaders);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.name).toBe("Coding");
			expect(data.allowedModels).toEqual(["minimax-m2-7"]);
			expect(new Date(data.expiresAt).getTime() - now).toBeGreaterThanOrEqual(7 * 86_400_000);
			expect(new Date(data.expiresAt).getTime() - now).toBeLessThan(7 * 86_400_000 + 1000);
			expect(mockCreateApiKey).toHaveBeenCalledWith("user_1", "Coding", expect.objectContaining({ allowedModels: ["minimax-m2-7"] }));
		});

		it.each([{ name: " " }, { expiresInDays: 0 }, { expiresInDays: 366 }, { expiresInDays: 1.5 }, { allowedModels: [] }, { allowedModels: ["fake-model"] }])("rejects invalid key controls %j without creating a credential", async body => {
			expect((await authReq("post", "/v1/keys", body, authedHeaders)).status).toBe(400);
			expect(mockCreateApiKey).not.toHaveBeenCalled();
		});

		it("rejects malformed JSON rather than creating a default credential", async () => {
			const app = new Hono(); app.route("/", authRoutes);
			const res = await app.request("/v1/keys", { method: "POST", headers: { ...authedHeaders, "Content-Type": "application/json" }, body: "{" });
			expect(res.status).toBe(400);
			expect(mockCreateApiKey).not.toHaveBeenCalled();
		});
		it("creates a key with default name when body is empty", async () => {
			mockCreateApiKey.mockResolvedValueOnce({
				id: "key_def",
				name: "default",
				prefix: "oma_sk_def",
				rawKey: "oma_sk_raw_default",
				createdAt: new Date(),
			});
			const res = await authReq("post", "/v1/keys", {}, authedHeaders);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.name).toBe("default");
		});

		it("creates a key and writes API_KEY_CREATED audit log", async () => {
			mockCreateApiKey.mockResolvedValueOnce({
				id: "key_new",
				name: "my-key",
				prefix: "oma_sk_xyz",
				rawKey: "oma_sk_raw_secret",
				createdAt: new Date(),
			});
			const res = await authReq("post", "/v1/keys", { name: "my-key" }, authedHeaders);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.id).toBe("key_new");
			expect(data.key).toBe("oma_sk_raw_secret");
			expect(auditLog).toHaveBeenCalledWith(
				expect.objectContaining({ action: "API_KEY_CREATED", resourceId: "key_new" }),
			);
		});
	});

	describe("DELETE /v1/keys/:id", () => {
		it("rejects malformed UUIDs before reaching the database", async () => {
			const res = await authReq("delete", "/v1/keys/not-a-uuid", undefined, authedHeaders);
			expect(res.status).toBe(400);
			expect(mockRevokeApiKey).not.toHaveBeenCalled();
		});

		it("returns 404 when key does not exist", async () => {
			mockRevokeApiKey.mockResolvedValueOnce(null);
			const res = await authReq("delete", "/v1/keys/10000000-0000-4000-8000-000000000001", undefined, authedHeaders);
			expect(res.status).toBe(404);
		});

		it("revokes the key and writes API_KEY_REVOKED audit log", async () => {
			mockRevokeApiKey.mockResolvedValueOnce(true);
			const res = await authReq("delete", "/v1/keys/10000000-0000-4000-8000-000000000002", undefined, authedHeaders);
			expect(res.status).toBe(200);
			expect(auditLog).toHaveBeenCalledWith(
				expect.objectContaining({ action: "API_KEY_REVOKED", resourceId: "10000000-0000-4000-8000-000000000002" }),
			);
		});
	});

	describe("DELETE /v1/history", () => {
		it("wipes usage records and audit logs, then writes HISTORY_CLEARED", async () => {
			mockDb.delete.mockReturnValue({
				where: vi.fn().mockResolvedValue({ rowCount: 5 }),
			});
			const res = await authReq("delete", "/v1/history", undefined, authedHeaders);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.success).toBe(true);
			expect(data.deleted.usageRecords).toBe(5);
			expect(auditLog).toHaveBeenCalledWith(
				expect.objectContaining({ action: "HISTORY_CLEARED" }),
			);
		});
	});

	describe("POST /v1/keys/install", () => {
		it("returns a retryable error without setting a cookie when key validation is unavailable", async () => {
			mockValidateApiKey.mockRejectedValueOnce(new DrizzleQueryError("select api_keys", ["oma_sk_valid_key_here"], new Error("key store disconnected")));
			const response = await authReq("post", "/v1/keys/install", { key: "oma_sk_valid_key_here" }, authedHeaders);
			expect(response.status).toBe(503);
			expect(await response.json()).toMatchObject({ error: { type: "service_unavailable", code: "auth_validation_unavailable" } });
			expect(response.headers.get("Set-Cookie")).toBeNull();
			expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain("oma_sk_valid_key_here");
		});

		it("rejects missing key with 400", async () => {
			const res = await authReq("post", "/v1/keys/install", {}, authedHeaders);
			expect(res.status).toBe(400);
		});

		it("rejects key with invalid characters with 400", async () => {
			const res = await authReq("post", "/v1/keys/install", { key: "bad key!" }, authedHeaders);
			expect(res.status).toBe(400);
		});

		it("installs a valid key as an HttpOnly cookie", async () => {
			const res = await authReq("post", "/v1/keys/install", { key: "oma_sk_valid_key_here" }, authedHeaders);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.success).toBe(true);
			expect(res.headers.get("Set-Cookie")).toContain("oma_api_key=");
		});

		it("rejects a valid key owned by another account without setting a cookie", async () => {
			mockValidateApiKey.mockResolvedValueOnce({
				id: "key_foreign",
				userId: "user_2",
				active: true,
				expiresAt: null,
			});
			const res = await authReq(
				"post",
				"/v1/keys/install",
				{ key: "oma_sk_foreign_key_here" },
				authedHeaders,
			);

			expect(res.status).toBe(403);
			expect(res.headers.get("Set-Cookie")).toBeNull();
			expect(await res.json()).toMatchObject({
				error: { message: "API key cannot be installed" },
			});
		});

		it("rejects an unknown key with the same generic response", async () => {
			mockValidateApiKey.mockResolvedValueOnce(null);
			const res = await authReq(
				"post",
				"/v1/keys/install",
				{ key: "oma_sk_unknown_key_here" },
				authedHeaders,
			);

			expect(res.status).toBe(403);
			expect(res.headers.get("Set-Cookie")).toBeNull();
			expect(await res.json()).toMatchObject({
				error: { message: "API key cannot be installed" },
			});
		});

		it("rejects an expired key owned by the session without setting a cookie", async () => {
			mockValidateApiKey.mockResolvedValueOnce({
				id: "key_expired",
				userId: "user_1",
				active: true,
				expiresAt: new Date("2020-01-01T00:00:00.000Z"),
			});
			const res = await authReq(
				"post",
				"/v1/keys/install",
				{ key: "oma_sk_expired_key_here" },
				authedHeaders,
			);

			expect(res.status).toBe(403);
			expect(res.headers.get("Set-Cookie")).toBeNull();
			expect(await res.json()).toMatchObject({
				error: { message: "API key cannot be installed" },
			});
		});
	});

	describe("POST /v1/keys/logout", () => {
		it("clears the API key cookie", async () => {
			const res = await authReq("post", "/v1/keys/logout", undefined, authedHeaders);
			expect(res.status).toBe(200);
			expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
		});
	});

	describe("DELETE /account", () => {
		it("returns 401 when no session", async () => {
			const res = await authReq("delete", "/account");
			expect(res.status).toBe(401);
		});

		it("deletes the account and writes audit logs", async () => {
			mockAuthApi.getSession.mockResolvedValueOnce({
				user: { id: "user_1" },
				session: { id: "s1", createdAt: new Date() },
			});
			mockDb.delete.mockReturnValue({
				where: vi.fn().mockResolvedValue({ rowCount: 1 }),
			});
			mockDb.insert.mockReturnValue({
				values: vi.fn().mockResolvedValue(undefined),
			});
			const res = await authReq("delete", "/account", undefined, authedHeaders);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.success).toBe(true);
			const cookies = res.headers.getSetCookie();
			expect(cookies).toEqual(expect.arrayContaining([
				expect.stringMatching(/^oma\.session_token=;.*Max-Age=0/),
				expect.stringMatching(/^__Secure-oma\.session_token=;.*Max-Age=0/),
			]));
			// A host-only tombstone cannot remove Better Auth's deployed domain cookie.
			for (const name of ["session_token", "session_data", "dont_remember", "account_data"]) {
				expect(cookies.some(cookie =>
					cookie.startsWith(`__Secure-oma.${name}=`) && cookie.includes("Domain=www.oma-ai.com") &&
					cookie.includes("Max-Age=0") && cookie.includes("Path=/"),
				)).toBe(true);
			}
			// ACCOUNT_DELETE_REQUESTED is written before the user row is deleted.
			expect(auditLog).toHaveBeenCalledWith(
				expect.objectContaining({ action: "ACCOUNT_DELETE_REQUESTED" }),
			);
		});

		it.each([new Date(Date.now() - 25 * 60 * 60 * 1000), "invalid", undefined])(
			"rejects stale or malformed session creation time %s before deletion",
			async (createdAt) => {
				mockAuthApi.getSession.mockResolvedValueOnce({
					user: { id: "user_1" },
					session: { id: "s1", createdAt, updatedAt: new Date() },
				});
				const res = await authReq("delete", "/account", undefined, authedHeaders);
				expect(res.status).toBe(400);
				expect(await res.json()).toMatchObject({ error: { type: "session_not_fresh" } });
				expect(mockDb.delete).not.toHaveBeenCalled();
				expect(auditLog).not.toHaveBeenCalled();
			},
		);
	});
});
