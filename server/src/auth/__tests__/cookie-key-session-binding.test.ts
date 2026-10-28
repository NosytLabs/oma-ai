import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { logger } from "../../lib/logger.js";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock("../api-keys.js", () => ({
	validateApiKey: mockValidateApiKey,
	isIpAllowedByList: vi.fn(() => true),
	shouldRecommendRotation: vi.fn(() => false),
}));

vi.mock("../../auth.js", () => ({
	auth: { api: { getSession: mockGetSession } },
}));

vi.mock("../../config.js", () => ({
	config: { NODE_ENV: "development", ADMIN_WALLET_ADDRESSES: "" },
	isProductionEnv: false,
	ADMIN_WALLET_ADDRESSES_SET: new Set<string>(),
}));

vi.mock("../../lib/logger.js", () => ({
	logger: {
		fatal: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
}));

vi.mock("../../db/client.js", () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn().mockResolvedValue([
						{ banned: false, suspended: false },
					]),
				})),
			})),
		})),
	},
}));

import { bearerAuth, optionalAuth, sessionAuth, sessionOrBearerAuth } from "../middleware.js";

function apiKey(userId: string) {
	return {
		id: `key_${userId}`,
		userId,
		active: true,
		expiresAt: null,
		ipAllowlist: null,
		createdAt: new Date(),
	};
}

function makeContext(headersInit: Record<string, string>) {
	const headers = new Headers(headersInit);
	const values = new Map<string, unknown>();
	return {
		req: {
			raw: { headers },
			header: (name: string) => headers.get(name) ?? undefined,
		},
		set: vi.fn((key: string, value: unknown) => values.set(key, value)),
		get: (key: string) => values.get(key),
		json: vi.fn((body: unknown, status = 200) =>
			new Response(JSON.stringify(body), {
				status,
				headers: { "Content-Type": "application/json" },
			}),
		),
		res: { headers: { set: vi.fn() } },
	};
}

describe("bearerAuth cookie key/session binding", () => {
	afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
	beforeEach(() => {
		vi.clearAllMocks();
		mockValidateApiKey.mockResolvedValue(apiKey("account-a"));
		mockGetSession.mockResolvedValue(null);
	});

	it.each([sessionAuth, sessionOrBearerAuth, optionalAuth])("returns a retryable safe error when session lookup fails", async (middleware) => {
		mockGetSession.mockRejectedValueOnce(new Error("private session storage diagnostic"));
		const context = makeContext({ Cookie: "oma.session_token=session-a" });
		const next = vi.fn();
		const response = await middleware(context as unknown as Parameters<typeof sessionAuth>[0], next);
		expect(response?.status).toBe(503);
		expect(await response?.json()).toEqual({ error: {
			message: "Account services are temporarily unavailable. Please try again shortly.",
			type: "service_unavailable", code: "auth_validation_unavailable",
		} });
		expect(next).not.toHaveBeenCalled();
	});

	it.each(["Authorization", "x-api-key"])("mixed auth honors explicit %s credentials over another account's session", async (header) => {
		mockGetSession.mockResolvedValue({ user: { id: "account-b" }, session: { id: "session-b" } });
		const context = makeContext({ [header]: header === "Authorization" ? "Bearer oma_sk_account_a" : "oma_sk_account_a", Cookie: "oma.session_token=session-b" });
		const next = vi.fn();
		await sessionOrBearerAuth(context as unknown as Parameters<typeof sessionOrBearerAuth>[0], next);
		expect(context.get("userId")).toBe("account-a");
		expect(context.get("apiKey")).toMatchObject({ userId: "account-a" });
		expect(mockGetSession).not.toHaveBeenCalled();
		expect(next).toHaveBeenCalledOnce();
	});

	it("mixed auth rejects a revoked explicit API key despite a valid browser session", async () => {
		mockGetSession.mockResolvedValue({ user: { id: "account-b" }, session: { id: "session-b" } });
		mockValidateApiKey.mockResolvedValueOnce(null);
		const context = makeContext({ Authorization: "Bearer revoked_key", Cookie: "oma.session_token=session-b" });
		const next = vi.fn();
		const response = await sessionOrBearerAuth(context as unknown as Parameters<typeof sessionOrBearerAuth>[0], next);
		expect(response?.status).toBe(401);
		expect(next).not.toHaveBeenCalled();
	});

	it.each([bearerAuth, optionalAuth, sessionOrBearerAuth])("rejects unsupported Authorization schemes instead of using a cookie", async (middleware) => {
		mockGetSession.mockResolvedValue({ user: { id: "account-a" }, session: { id: "session-a" } });
		const context = makeContext({ Authorization: "Basic rejected", Cookie: "oma.session_token=session-a; oma_api_key=oma_sk_account_a" });
		const next = vi.fn();
		const response = await middleware(context as unknown as Parameters<typeof bearerAuth>[0], next);
		expect(response?.status).toBe(401);
		expect(next).not.toHaveBeenCalled();
		expect(mockValidateApiKey).not.toHaveBeenCalled();
	});

	it.each(["Authorization", "x-api-key"])("rejects an empty explicit %s instead of using a cookie", async (header) => {
		mockGetSession.mockResolvedValue({ user: { id: "account-a" }, session: { id: "session-a" } });
		const context = makeContext({ [header]: "", Cookie: "oma.session_token=session-a; oma_api_key=oma_sk_account_a" });
		const next = vi.fn();
		const response = await optionalAuth(context as unknown as Parameters<typeof optionalAuth>[0], next);
		expect(response?.status).toBe(401);
		expect(next).not.toHaveBeenCalled();
		expect(mockValidateApiKey).not.toHaveBeenCalled();
	});

	it.each(["key", "session"])("does not log SQL values when %s validation fails", async (failure) => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NEON_FUNCTION", "1");
		const output = vi.spyOn(console, "error").mockImplementation(() => {});
		const actual = await vi.importActual<typeof import("../../lib/logger.js")>("../../lib/logger.js");
		vi.mocked(logger.error).mockImplementationOnce((record, message) => actual.logger.error(record, message));
		const error = new DrizzleQueryError("select private_auth where token = $1", ["synthetic-secret"], Object.assign(new Error("private driver detail"), { code: "08006" }));
		if (failure === "key") mockValidateApiKey.mockRejectedValueOnce(error);
		else mockGetSession.mockRejectedValueOnce(error);
		const context = makeContext({ Cookie: "oma_api_key=oma_sk_account_a" });
		const response = await bearerAuth(context as unknown as Parameters<typeof bearerAuth>[0], vi.fn());
		expect(response?.status).toBe(503);
		const line = output.mock.calls[0][0] as string;
		expect(line).not.toContain("synthetic-secret");
		expect(line).not.toContain("private_auth");
		expect(JSON.parse(line).err).toEqual({ type: "DatabaseError", code: "08006" });
	});

	it("accepts an API-key cookie owned by the current session", async () => {
		mockGetSession.mockResolvedValueOnce({
			user: { id: "account-a" },
			session: { id: "session-a", userId: "account-a" },
		});
		const context = makeContext({
			Cookie: "better-auth.session_token=session-a; oma_api_key=oma_sk_account_a",
		});
		const next = vi.fn();

		await bearerAuth(
			context as unknown as Parameters<typeof bearerAuth>[0],
			next,
		);

		expect(next).toHaveBeenCalledTimes(1);
		expect(context.set).toHaveBeenCalledWith(
			"apiKey",
			expect.objectContaining({ userId: "account-a" }),
		);
	});

	it("rejects account A's stale API-key cookie under account B's session", async () => {
		mockGetSession.mockResolvedValueOnce({
			user: { id: "account-b" },
			session: { id: "session-b", userId: "account-b" },
		});
		const context = makeContext({
			Cookie: "better-auth.session_token=session-b; oma_api_key=oma_sk_account_a",
		});
		const next = vi.fn();

		await bearerAuth(
			context as unknown as Parameters<typeof bearerAuth>[0],
			next,
		);

		expect(next).not.toHaveBeenCalled();
		expect(context.json).toHaveBeenCalledWith(
			expect.objectContaining({
				error: expect.objectContaining({ type: "authentication_error" }),
			}),
			401,
		);
	});

	it("rejects an API-key cookie without a valid Better Auth session", async () => {
		const context = makeContext({ Cookie: "oma_api_key=oma_sk_account_a" });
		const next = vi.fn();

		await bearerAuth(
			context as unknown as Parameters<typeof bearerAuth>[0],
			next,
		);

		expect(next).not.toHaveBeenCalled();
		expect(context.json).toHaveBeenCalledWith(expect.any(Object), 401);
	});

	it.each(["oma_api_key=%", "__Host-oma_api_key=%E0%A4%A"])(
		"rejects malformed cookie encoding without failing the request: %s",
		async (cookie) => {
			const context = makeContext({ Cookie: cookie });
			const next = vi.fn();
			const response = await bearerAuth(
				context as unknown as Parameters<typeof bearerAuth>[0], next,
			);
			expect(response?.status).toBe(401);
			expect(await response?.json()).toEqual({
				error: expect.objectContaining({ type: "authentication_error" }),
			});
			expect(next).not.toHaveBeenCalled();
			expect(mockValidateApiKey).not.toHaveBeenCalled();
		},
	);

	it.each([
		["Authorization", "Bearer oma_sk_account_a"],
		["x-api-key", "oma_sk_account_a"],
	])("keeps explicit %s API-key authentication independent of browser sessions", async (header, value) => {
		const context = makeContext({
			[header]: value,
			Cookie: "better-auth.session_token=session-b",
		});
		const next = vi.fn();

		await bearerAuth(
			context as unknown as Parameters<typeof bearerAuth>[0],
			next,
		);

		expect(next).toHaveBeenCalledTimes(1);
		expect(mockGetSession).not.toHaveBeenCalled();
	});
});
