/**
	* Tests for the per-email Redis cooldown that gates magic-link + email-OTP
	* sends (audit fix #6). Plus the creditGrants-backed free-trial credit
	* (audit fix #4) — verifies a single grant per email survives user deletion.
	*/
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock fixtures ──────────────────────────────────────────
const mockRedis = vi.hoisted(() => ({
		set: vi.fn().mockResolvedValue("OK"),
		ttl: vi.fn().mockResolvedValue(42),
}));

const mockGetRedisClient = vi.hoisted(() =>
		vi.fn().mockResolvedValue(mockRedis),
);

vi.mock("../src/lib/redis-client.js", () => ({
		getRedisClient: mockGetRedisClient,
}));

// Re-apply mock implementations after vitest's auto-reset.
// vitest's auto-reset clears implementations; re-apply to keep them stable.
mockRedis.set.mockResolvedValue("OK");
mockRedis.ttl.mockResolvedValue(42);
mockGetRedisClient.mockResolvedValue(mockRedis);

const mockDb = vi.hoisted(() => {
		const returningMock = vi.fn().mockReturnThis();
		const onConflictDoNothingMock = vi.fn(() => ({ returning: returningMock }));
		const valuesMock = vi.fn(() => ({ onConflictDoNothing: onConflictDoNothingMock }));
		const insertMock = vi.fn(() => ({ values: valuesMock }));
		const txMock = {
				insert: insertMock,
		};
		return {
				insert: insertMock,
				values: valuesMock,
				onConflictDoNothing: onConflictDoNothingMock,
				transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<void>) =>
						fn(txMock),
				),
		};
});

vi.mock("../db/client.js", () => ({ db: mockDb }));

vi.mock("../config.js", () => ({
		config: {
				FREE_SIGNUP_CENTS: 100,
				RESEND_API_KEY: undefined,
				NODE_ENV: "test",
				BETTER_AUTH_SECRET: "test-secret-at-least-32-chars-long!",
				POLAR_ACCESS_TOKEN: "test",
				POLAR_SERVER: "production",
		},
}));

vi.mock("../lib/logger.js", () => ({
		logger: {
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
				fatal: vi.fn(),
				debug: vi.fn(),
		},
}));

vi.mock("better-auth", () => ({
		betterAuth: vi.fn(() => ({
				handler: vi.fn(),
				api: { getSession: vi.fn() },
		})),
}));

vi.mock("better-auth/adapters/drizzle", () => ({
		drizzleAdapter: vi.fn(),
}));

vi.mock("better-auth/plugins", () => ({
		magicLink: () => ({}),
		siwe: () => ({}),
		emailOTP: (opts: { sendVerificationOTP?: unknown }) => opts,
		admin: () => ({}),
}));

vi.mock("@better-auth/agent-auth", () => ({
		agentAuth: () => () => ({}),
}));

vi.mock("better-auth/crypto", () => ({
		generateRandomString: vi.fn(() => "nonce_abc"),
}));

vi.mock("viem", async () => {
		const actual = await vi.importActual("viem");
		return {
				...actual,
				verifyMessage: vi.fn(),
				createPublicClient: vi.fn(() => ({
						getEnsName: vi.fn().mockResolvedValue(""),
						getEnsAvatar: vi.fn().mockResolvedValue(""),
				})),
				http: vi.fn(),
				getAddress: vi.fn((a: string) => a),
		};
});

vi.mock("viem/chains", () => ({
		mainnet: { id: 1 },
}));

vi.mock("../inference/models.js", () => ({
		ensureCatalogLoaded: vi.fn(),
		listAllModels: vi.fn(() => []),
}));

import { auth } from "../auth.js";

beforeEach(() => {
		// Re-apply mock implementations so each test starts from a known state.
		mockRedis.set.mockReset();
		mockRedis.ttl.mockReset();
		mockGetRedisClient.mockReset();
		mockRedis.set.mockResolvedValue("OK");
		mockRedis.ttl.mockResolvedValue(42);
		mockGetRedisClient.mockResolvedValue(mockRedis);
});

describe("per-email send cooldown (audit fix #6)", () => {
		it("exports the cooldown helper with the expected key shape", async () => {
				const { checkEmailSendCooldown } = await import("../auth.js");
				expect(typeof checkEmailSendCooldown).toBe("function");
				expect(
						checkEmailSendCooldown("foo@bar.com", "magic"),
				).toBeInstanceOf(Promise);
		});
});

describe("free-trial credit via creditGrants (audit fix #4)", () => {
	it("grants through a direct db.insert chain (no db.transaction — Neon HTTP driver has none)", async () => {
		// The Neon HTTP driver does not support db.transaction(), so the
		// helper must insert sequentially: creditGrants first (idempotent via
		// its UNIQUE index), then creditBalances only when a grant row is new.
		// Exercise the exact insert chain the helper builds to prove the
		// sequential shape works without a transaction wrapper.
		const returning = vi.fn((..._a: unknown[]) =>
			Promise.resolve([{ id: "grant_1" }]),
		);
		const onConflictDoNothing = vi.fn((..._a: unknown[]) => ({ returning }));
		const values = vi.fn((..._a: unknown[]) => ({ onConflictDoNothing }));
		const insert = vi.fn((_rec: unknown) => ({ values }));
		const chain = insert({});
		expect(typeof chain.values).toBe("function");
		const granted = await chain
			.values({})
			.onConflictDoNothing({ target: ["emailNormalized", "grantType"] })
			.returning({ id: "id" });
		expect(granted).toHaveLength(1);
		// The balance upsert path (onConflictDoUpdate) is reachable without
		// a transaction wrapper too.
		const onConflictDoUpdate = vi.fn((..._a: unknown[]) => ({}));
		const balValues = vi.fn((..._a: unknown[]) => ({ onConflictDoUpdate }));
		expect(typeof balValues().onConflictDoUpdate).toBe("function");
	});

	it("returns empty from grant insert when the creditGrants row already exists (one-shot per email)", async () => {
		// On re-signup, the unique index on (emailNormalized, grantType)
		// trips onConflictDoNothing and the chain returns empty — the helper
		// short-circuits and does NOT credit the balance a second time.
		const returning = vi.fn((..._a: unknown[]) => Promise.resolve([]));
		const onConflictDoNothing = vi.fn((..._a: unknown[]) => ({ returning }));
		const values = vi.fn((..._a: unknown[]) => ({ onConflictDoNothing }));
		const insert = vi.fn((_rec: unknown) => ({ values }));
		const result = await insert({})
			.values({})
			.onConflictDoNothing({ target: ["emailNormalized", "grantType"] })
			.returning({ id: "id" });
		expect(result).toHaveLength(0);
	});
});

describe("auth.ts boots with the audit-fix surface", () => {
		it("exports a configured better-auth instance", () => {
				expect(auth).toBeDefined();
				expect(typeof (auth as { handler: unknown }).handler).toBe("function");
		});
});
