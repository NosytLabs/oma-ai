/**
	* Tests for the per-email Redis cooldown that gates magic-link + email-OTP
	* sends (audit fix #6). Plus the creditGrants-backed free-trial credit
	* (audit fix #4) — verifies a single grant per email survives user deletion.
	*/
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BetterAuthOptions } from "better-auth";
import type { EmailOTPOptions } from "better-auth/plugins";
import { getCookies } from "better-auth/cookies";

// ── Hoisted mock fixtures ──────────────────────────────────────────
const mockRedis = vi.hoisted(() => ({
		set: vi.fn().mockResolvedValue("OK"),
		ttl: vi.fn().mockResolvedValue(42),
}));

const mockGetRedisClient = vi.hoisted(() =>
		vi.fn().mockResolvedValue(mockRedis),
);

vi.mock("../lib/redis-client.js", () => ({
		getRedisClient: mockGetRedisClient,
}));

// Re-apply mock implementations after vitest's auto-reset.
// vitest's auto-reset clears implementations; re-apply to keep them stable.
mockRedis.set.mockResolvedValue("OK");
mockRedis.ttl.mockResolvedValue(42);
mockGetRedisClient.mockResolvedValue(mockRedis);

const mockDb = vi.hoisted(() => ({
	insert: vi.fn(),
	transaction: vi.fn(),
}));

vi.mock("../db/client.js", () => ({ db: mockDb }));

vi.mock("../config.js", () => ({
		config: {
				FREE_SIGNUP_CENTS: 100,
				RESEND_API_KEY: undefined,
				NODE_ENV: "production",
				PRIMARY_DOMAIN: "www.oma-ai.com",
				PUBLIC_APP_URL: "http://127.0.0.1:3000",
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


const capturedAuth = vi.hoisted(() => ({ options: undefined as BetterAuthOptions | undefined }));
vi.mock("better-auth", () => ({
		betterAuth: vi.fn((options: BetterAuthOptions) => {
			capturedAuth.options = options;
			return {
				handler: vi.fn(),
				api: { getSession: vi.fn() },
			};
		}),
}));

vi.mock("better-auth/adapters/drizzle", () => ({
		drizzleAdapter: vi.fn(),
}));

// Capture the options each plugin was constructed with so tests can assert
// the real security-relevant config (e.g. magicLink's storeToken).
const capturedPluginOpts = vi.hoisted(() => ({
	magicLink: undefined as Record<string, unknown> | undefined,
	siwe: undefined as Record<string, unknown> | undefined,
	emailOTP: undefined as EmailOTPOptions | undefined,
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
	emailOTP: (opts: EmailOTPOptions) => {
		capturedPluginOpts.emailOTP = opts;
		return opts;
	},
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
	it("rejects a rapid OTP resend before replacing the code that was already delivered", async () => {
		const { betterAuth } = await vi.importActual<typeof import("better-auth")>("better-auth");
		const { emailOTP } = await vi.importActual<typeof import("better-auth/plugins")>("better-auth/plugins");
		const { memoryAdapter } = await import("better-auth/adapters/memory");
		const { config } = await import("../config.js");
		const records = { user: [], session: [], account: [], verification: [] as Array<{ value: string }> };
		let deliveredOTP = "";
		const otpOptions = capturedPluginOpts.emailOTP!;
		const localAuth = betterAuth({
			baseURL: "https://www.oma-ai.com",
			secret: "isolated-otp-regression-secret-16bac4e8-294d-4733-80ff",
			database: memoryAdapter(records),
			advanced: { disableCSRFCheck: false, disableOriginCheck: false },
			hooks: { before: capturedAuth.options?.hooks?.before },
			plugins: [emailOTP({ ...otpOptions, async sendVerificationOTP(data, ctx) {
				deliveredOTP = data.otp;
				await otpOptions.sendVerificationOTP(data, ctx);
			} })],
		});
		config.NODE_ENV = "development";
		try {
			const body = { email: "resend@example.org", type: "sign-in" as const };
			const untrusted = await localAuth.handler(new Request("https://www.oma-ai.com/api/auth/email-otp/send-verification-otp", {
				method: "POST", headers: { "Content-Type": "application/json", Origin: "https://untrusted.example" },
				body: JSON.stringify(body),
			}));
			expect(untrusted.status).toBe(403);
			expect(mockRedis.set).not.toHaveBeenCalled();
			expect(records.verification).toHaveLength(0);
			const send = () => localAuth.handler(new Request("https://www.oma-ai.com/api/auth/email-otp/send-verification-otp", {
				method: "POST",
				headers: { "Content-Type": "application/json", Origin: "https://www.oma-ai.com" },
				body: JSON.stringify(body),
			}));
			expect((await send()).status).toBe(200);
			const deliveredCode = records.verification[0].value;
			mockRedis.set.mockResolvedValue(null);
			const rejected = await send();
			expect(rejected.status).toBe(429);
			expect(rejected.headers.get("retry-after")).toBe("42");
			expect(records.verification).toHaveLength(1);
			expect(records.verification[0].value).toBe(deliveredCode);
			const signedIn = await localAuth.handler(new Request("https://www.oma-ai.com/api/auth/sign-in/email-otp", {
				method: "POST", headers: { "Content-Type": "application/json", Origin: "https://www.oma-ai.com" },
				body: JSON.stringify({ email: body.email, otp: deliveredOTP }),
			}));
			expect(signedIn.status).toBe(200);
			expect((await signedIn.json()).user.emailVerified).toBe(true);
		} finally {
			config.NODE_ENV = "production";
		}
	});
		it("exports the cooldown helper with the expected key shape", async () => {
				const { checkEmailSendCooldown } = await import("../auth.js");
				expect(typeof checkEmailSendCooldown).toBe("function");
				expect(
						checkEmailSendCooldown("foo@bar.com", "magic"),
				).toBeInstanceOf(Promise);
		});
});

describe("free-trial credit via the real signup hook", () => {
	async function createUser(email = "user@example.org", id = "usr_trial") {
		const hook = capturedAuth.options!.databaseHooks!.user!.create!.after!;
		await hook({ id, email, emailVerified: true, name: "Test", createdAt: new Date(), updatedAt: new Date() }, null);
	}

	function fakeLedger(failBalance = false) {
		const state = { grants: new Set<string>(), balance: 0 };
		const insert = (_table: unknown) => ({
			values: (value: { emailNormalized?: string; balanceCents?: string }) => ({
				onConflictDoNothing: () => ({ returning: async () => {
					const key = value.emailNormalized!;
					if (state.grants.has(key)) return [];
					state.grants.add(key);
					return [{ id: "grant_1" }];
				} }),
				onConflictDoUpdate: async () => {
					if (failBalance) throw new Error("balance write failed");
					state.balance += Number(value.balanceCents);
				},
			}),
		});
		mockDb.insert.mockImplementation(insert);
		mockDb.transaction.mockImplementation(async (run: (tx: { insert: typeof insert }) => Promise<unknown>) => {
			const grants = new Set(state.grants);
			const balance = state.balance;
			try { return await run({ insert }); }
			catch (error) {
				state.grants = grants;
				state.balance = balance;
				throw error;
			}
		});
		return state;
	}

	it("credits once per normalized email, including after the user is recreated", async () => {
		const ledger = fakeLedger();
		await createUser(" User@Example.org ");
		await createUser("user@example.org", "usr_recreated");
		expect(ledger.grants).toEqual(new Set(["user@example.org"]));
		expect(ledger.balance).toBe(100);
	});

	it("does not consume the one-shot trial if the balance write fails", async () => {
		const ledger = fakeLedger(true);
		await createUser();
		expect(ledger.grants.size).toBe(0);
		expect(ledger.balance).toBe(0);
	});
});

describe("auth.ts boots with the audit-fix surface", () => {
		it("exports a configured better-auth instance", () => {
			expect(auth).toBeDefined();
			expect(typeof (auth as { handler: unknown }).handler).toBe("function");
		});
});

describe("auth plugin security configuration", () => {
	it("issues cookies for the canonical site even with a stale public app URL", () => {
		const cookies = getCookies(capturedAuth.options!);
		expect(cookies.sessionToken.attributes.domain).toBe("www.oma-ai.com");
		expect(cookies.sessionToken.attributes.secure).toBe(true);
	});
	it("does not double-prefix a PRIMARY_DOMAIN that already includes www", () => {
		const input = { PRIMARY_DOMAIN: "https://WWW.oma-ai.com/", PUBLIC_APP_URL: "http://localhost:3000", NODE_ENV: "production" };
		expect(resolveAuthBaseURL(input)).toBe("https://www.oma-ai.com");
		expect(resolveTrustedOrigins(input)).toEqual(expect.arrayContaining(["https://oma-ai.com", "https://www.oma-ai.com"]));
		expect(resolveTrustedOrigins(input)).not.toContain("https://www.www.oma-ai.com");
	});

	it("does not trust stale localhost URLs in a deployed environment", () => {
		const input = { PRIMARY_DOMAIN: "www.oma-ai.com", PUBLIC_APP_URL: "http://localhost:3000", NODE_ENV: "production" };
		expect(resolveTrustedOrigins(input)).not.toContain("http://localhost:3000");
	});

	it("keeps preview subdomains intact when selecting a callback host", () => {
		expect(resolveAuthBaseURL({ PRIMARY_DOMAIN: "preview.example.org", PUBLIC_APP_URL: "https://preview.example.org", NODE_ENV: "preview" })).toBe("https://preview.example.org");
	});
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


describe("session revocation with the production cookie policy", () => {
	it("rejects a replayed session immediately after it is signed out", async () => {
		const { betterAuth } = await vi.importActual<typeof import("better-auth")>("better-auth");
		const { memoryAdapter } = await import("better-auth/adapters/memory");
		const localAuth = betterAuth({
			baseURL: "https://www.oma-ai.com",
			secret: "isolated-auth-regression-secret-16bac4e8-294d-4733-80ff",
			database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
			emailAndPassword: { enabled: true },
			session: capturedAuth.options!.session,
			advanced: capturedAuth.options!.advanced,
		});
		const response = await localAuth.api.signUpEmail({
			body: { name: "Test", email: "revoke@example.org", password: "memory-only-test-password" },
			asResponse: true,
		});
		expect(response.status).toBe(200);
		const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
		const headers = new Headers({ cookie, origin: "https://www.oma-ai.com" });
		expect((await localAuth.api.getSession({ headers }))?.user.email).toBe("revoke@example.org");
		await localAuth.api.signOut({ headers });
		expect(await localAuth.api.getSession({ headers })).toBeNull();
	});
});
