import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { bearerAuth } from "../middleware.js";

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
	beforeEach(() => {
		vi.clearAllMocks();
		mockValidateApiKey.mockResolvedValue(apiKey("account-a"));
		mockGetSession.mockResolvedValue(null);
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
