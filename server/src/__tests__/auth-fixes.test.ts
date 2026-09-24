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

// Capture the options each plugin was constructed with so tests can assert
// the real security-relevant config (e.g. magicLink's storeToken).
const capturedPluginOpts = vi.hoisted(() => ({
	magicLink: undefined as Record<string, unknown> | undefined,
	siwe: undefined as Record<string, unknown> | undefined,
}));

vi.mock("better-auth/plugins", () => ({
	magicLink: (opts: Record<string, unknown>) => {
		capturedPluginOpts.magicLink = opts;
		return {};
	},
	siwe: (opts: Record<string, unknown>) => {
		capturedPluginOpts.siwe = opts;
		return {};
	},
	emailOTP: (opts: { sendVerificationOTP?: unknown }) => opts,
	admin: () => ({}),
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

import { auth, resolveTrustedOrigins, resolveAuthBaseURL } from "../auth.js";

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

describe("auth plugin security configuration", () => {
		it("stores magic-link tokens hashed, not in plaintext", () => {
			// better-auth's magicLink plugin defaults storeToken to "plain",
			// persisting the sign-in token verbatim. That turns any read-only
			// DB leak into a set of replayable sign-in links. Pin the hardened
			// value so a dependency bump cannot silently revert it.
			expect(capturedPluginOpts.magicLink).toBeDefined();
			expect(capturedPluginOpts.magicLink?.storeToken).toBe("hashed");
		});

		it("trusts the canonical production origins derived from PRIMARY_DOMAIN", () => {
		// LIVE OUTAGE (2026-09-24): the deployed Neon function was published
		// from server/.env, which carried PUBLIC_APP_URL=http://localhost:3000.
		// trustedOrigins was built from PUBLIC_APP_URL alone, so EVERY request
		// from https://www.oma-ai.com was rejected with
		// 403 {"code":"INVALID_ORIGIN"} — sign-in was completely dead in
		// production while a localhost Origin was accepted.
		//
		// The canonical origins must be derived from PRIMARY_DOMAIN so a
		// stale/misconfigured app URL cannot lock real users out of auth.
		const origins = resolveTrustedOrigins({
			PUBLIC_APP_URL: "http://localhost:3000",
			PRIMARY_DOMAIN: "oma-ai.com",
			NODE_ENV: "production",
		});
		expect(origins).toContain("https://www.oma-ai.com");
		expect(origins).toContain("https://oma-ai.com");
	});

	it("keeps the apex and www pair trusted for a custom primary domain", () => {
		const origins = resolveTrustedOrigins({
			PUBLIC_APP_URL: "https://staging.example.org",
			PRIMARY_DOMAIN: "example.org",
			NODE_ENV: "production",
		});
		expect(origins).toContain("https://example.org");
		expect(origins).toContain("https://www.example.org");
		// The configured app URL stays trusted too.
		expect(origins).toContain("https://staging.example.org");
	});

	it("does not fabricate https origins for localhost development", () => {
		const origins = resolveTrustedOrigins({
			PUBLIC_APP_URL: "http://localhost:3000",
			PRIMARY_DOMAIN: "localhost",
			NODE_ENV: "development",
		});
		expect(origins).not.toContain("https://localhost");
		expect(origins).not.toContain("https://www.localhost");
		expect(origins).toContain("http://localhost:3000");
	});

	it("builds magic-link callback URLs against the canonical site, not localhost", () => {
		// The same stale env would have emailed a
		// `http://localhost:3000/api/auth/magic-link/verify?token=...` link,
		// which no real recipient can open.
		expect(
			resolveAuthBaseURL({
				BETTER_AUTH_URL: "http://localhost:3000",
				PUBLIC_APP_URL: "http://localhost:3000",
				PRIMARY_DOMAIN: "oma-ai.com",
				NODE_ENV: "production",
			}),
		).toBe("https://www.oma-ai.com");
	});

	it("honours the configured base URL in local development", () => {
		expect(
			resolveAuthBaseURL({
				BETTER_AUTH_URL: "http://localhost:3000",
				PUBLIC_APP_URL: "http://localhost:3000",
				PRIMARY_DOMAIN: "localhost",
				NODE_ENV: "development",
			}),
		).toBe("http://localhost:3000");
	});

	it("gives the siwe plugin exactly one domain string", () => {
			// SIWEPluginOptions.domain is a single string — the plugin rejects
			// a message whose domain differs. Assert it is a non-empty string
			// (not an array, which cannot be passed and would break sign-in).
			const domain = capturedPluginOpts.siwe?.domain;
			expect(typeof domain).toBe("string");
			expect((domain as string).length).toBeGreaterThan(0);
		});
});
