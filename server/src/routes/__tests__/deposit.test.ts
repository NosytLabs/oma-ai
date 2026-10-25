/**
 * Integration tests for the real deposit route handler (deposit/index.ts).
 *
 * The existing deposit-index.test.ts mocks the entire router, so it never
 * exercises the real handler. These tests mock only the DB, auth middleware,
 * audit logger, rate-limit, and config — the route logic itself is real.
 *
 * Covers:
 *   GET  /v1/balance             — balance fetch (found + not-found)
 *   GET  /v1/deposit/usdc        — instructions (configured + unconfigured)
 *   GET  /v1/site-settings       — public settings (DB hit + DB miss fallback)
 *   POST /v1/deposit/usdc        — validation, min/max, duplicate txHash, success
 *   GET  /v1/deposit/status      — deposit history list
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
vi.mock("../../lib/credit-holds.js", () => ({ readCreditHoldTotals: async () => ({ reservedCents: "0", reconciliationCents: "0" }) }));

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../middleware/rate-limit.js", () => ({
	rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../../auth/middleware.js", () => ({
	sessionOrBearerAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
		c.set("userId", "user_1");
		await next();
	},
}));

vi.mock("../../middleware/audit.js", () => ({
	auditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/logger.js", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

// Config mock — USDC_DEPOSIT_ADDRESS is set by default; tests can override.
const mockConfig = vi.hoisted(() => ({
	USDC_DEPOSIT_ADDRESS: "0x0000000000000000000000000000000000000001" as string | undefined,
	USDC_DEPOSIT_NETWORK: "base" as const,
	USDC_DEPOSIT_MIN_CENTS: 100,
	USDC_DEPOSIT_MAX_CENTS: 1000000,
}));
vi.mock("../../config.js", () => ({ config: mockConfig }));

// DB mock
const mockDb = vi.hoisted(() => {
	const chain = () => {
		const self: any = {
			from: vi.fn(() => self),
			where: vi.fn(() => self),
			orderBy: vi.fn(() => self),
			limit: vi.fn(() => self),
		};
		return self;
	};
	return {
		select: vi.fn(() => chain()),
		insert: vi.fn(() => ({
			values: vi.fn(() => ({
				returning: vi.fn().mockResolvedValue([{ id: "dep_new" }]),
			})),
		})),
	};
});
vi.mock("../../db/client.js", () => ({ db: mockDb }));

vi.mock("../../db/schema.js", () => ({
	creditBalances: { userId: "userId" },
	deposits: { userId: "userId", txHash: "txHash", createdAt: "createdAt" },
	siteSettings: { cryptoPaymentsEnabled: "cryptoPaymentsEnabled" },
}));

// SECURITY (deposit Blocker): mock the challenge/signature proof gate so the
// route tests control whether proof passes. This mirrors usage in production
// where verifyDepositSignature does an on-chain recoverMessage.
const mockChallenge = vi.hoisted(() => ({
	issueDepositChallenge: vi.fn(() => ({
		token: "test-token-value-abcdef1234567890",
		nonce: "testnonce",
		expiresAt: Date.now() + 300000,
	})),
	verifyDepositChallenge: vi.fn((_a: unknown) => ({ ok: true, payload: { userId: "user_1" } }) as
		| { ok: true; payload: { userId: string } }
		| { ok: false; reason: string }),
	verifyDepositSignature: vi.fn(async () => true),
}));
vi.mock("../../lib/deposit-challenge.js", () => mockChallenge);

import { depositRoutes } from "../deposit/index.js";
import { auditLog } from "../../middleware/audit.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function depositReq(method: "get" | "post", path: string, body?: unknown) {
	const app = new Hono();
	app.route("/", depositRoutes);
	return app.request(
		new Request(`http://localhost${path}`, {
			method: method.toUpperCase(),
			headers: { "Content-Type": "application/json" },
			body: body ? JSON.stringify(body) : undefined,
		}),
	);
}

function mockSelectReturns(...rows: any[][]) {
	mockDb.select.mockImplementation(() => {
		const idx = (mockSelectReturns as any)._callCount ?? 0;
		(mockSelectReturns as any)._callCount = idx + 1;
		const r = rows[idx] ?? [];
		const limit = vi.fn().mockResolvedValue(r);
		const orderBy = vi.fn().mockReturnValue({ limit });
		const where = vi.fn().mockReturnValue({ limit, orderBy });
		const from = vi.fn().mockReturnValue({ where, limit, orderBy });
		return { from, where, limit, orderBy };
	});
}

const validTxHash = "0x" + "a1".repeat(32);
const validFromAddress = "0x" + "b2".repeat(20);
const validChallengeToken = "test-token-value-abcdef1234567890";
const validSignature = "0x" + "c3".repeat(65);

beforeEach(() => {
	vi.clearAllMocks();
	(mockSelectReturns as any)._callCount = 0;
	mockConfig.USDC_DEPOSIT_ADDRESS = "0x0000000000000000000000000000000000000001";
	mockConfig.USDC_DEPOSIT_MIN_CENTS = 100;
	mockConfig.USDC_DEPOSIT_MAX_CENTS = 1000000;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("deposit routes (real handler)", () => {
	describe("GET /v1/balance", () => {
		it("returns zero balance when no row exists", async () => {
			mockSelectReturns([]); // no creditBalances row
			const res = await depositReq("get", "/v1/balance");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.balanceCents).toBe("0");
			expect(data.userId).toBe("user_1");
		});

		it("returns the stored balance", async () => {
			mockSelectReturns([{ balanceCents: "5000", totalDepositedCents: "10000", totalUsedCents: "5000" }]);
			const res = await depositReq("get", "/v1/balance");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.balanceCents).toBe("5000");
		});

		it.each([
			["-0.00000001", "0.00000001"],
			["-9007199254740993.12345678", "9007199254740993.12345678"],
		])("presents refunded balance %s as zero spendable credits and exact debt", async (balanceCents, debtCents) => {
			mockSelectReturns([{ balanceCents, totalDepositedCents: "10000", totalUsedCents: "5000" }]);
			const res = await depositReq("get", "/v1/balance");
			expect(res.status).toBe(200);
			expect(await res.json()).toMatchObject({ balanceCents: "0", debtCents, reservedCents: "0", reconciliationCents: "0" });
		});

		it.each(["0", "-0.00000000", "0.00000001", "9007199254740993.12345678"])("omits debt when the stored balance %s has no shortfall", async balanceCents => {
			mockSelectReturns([{ balanceCents }]);
			const data = await (await depositReq("get", "/v1/balance")).json();
			expect(data.balanceCents).toBe(balanceCents.startsWith("-") ? "0" : balanceCents);
			expect(data).not.toHaveProperty("debtCents");
		});
	});

	describe("GET /v1/deposit/usdc (instructions)", () => {
		it.each([
			["get", "/v1/deposit/usdc"],
			["post", "/v1/deposit/usdc/challenge"],
			["post", "/v1/deposit/usdc"],
		] as const)("refuses %s %s when payment settings cannot be read", async (method, path) => {
			mockDb.select.mockImplementationOnce(() => { throw new Error("private database connection failure"); });
			const res = await depositReq(method, path, method === "post" ? { fromAddress: validFromAddress } : undefined);
			expect(res.status).toBe(503);
			expect(await res.text()).not.toMatch(/private database connection/);
		});

		it("refuses a wallet challenge while crypto funding is paused", async () => {
			mockSelectReturns([{ cryptoPaymentsEnabled: false }]);
			expect((await depositReq("post", "/v1/deposit/usdc/challenge", { fromAddress: validFromAddress })).status).toBe(503);
		});
		it("returns deposit instructions when configured", async () => {
			mockSelectReturns([{ cryptoPaymentsEnabled: true }]); // siteSettings
			const res = await depositReq("get", "/v1/deposit/usdc");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.depositAddress).toBe("0x0000000000000000000000000000000000000001");
			expect(data.network).toBe("base");
			expect(data.chainId).toBe(8453);
			expect(data.usdcContract).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
		});

		it("returns 503 when USDC_DEPOSIT_ADDRESS is not configured", async () => {
			mockConfig.USDC_DEPOSIT_ADDRESS = undefined;
			mockSelectReturns([{ cryptoPaymentsEnabled: true }]);
			const res = await depositReq("get", "/v1/deposit/usdc");
			expect(res.status).toBe(503);
			const data = await res.json();
			expect(data.error.type).toBe("not_configured");
		});

		it("returns 503 when crypto deposits are disabled by admin", async () => {
			mockSelectReturns([{ cryptoPaymentsEnabled: false }]);
			const res = await depositReq("get", "/v1/deposit/usdc");
			expect(res.status).toBe(503);
			const data = await res.json();
			expect(data.error.type).toBe("service_unavailable");
		});
	});

	describe("GET /v1/site-settings", () => {
		it("returns settings from DB when available", async () => {
			mockSelectReturns([{
				maintenanceMode: true,
				cardPaymentsEnabled: false,
				cryptoPaymentsEnabled: true,
			}]);
			const res = await depositReq("get", "/v1/site-settings");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.maintenanceMode).toBe(true);
			expect(data.cardPaymentsEnabled).toBe(false);
		});

		it("keeps public configuration readable but disables payments when DB fails", async () => {
			mockDb.select.mockImplementationOnce(() => { throw new Error("DB down"); });
			const res = await depositReq("get", "/v1/site-settings");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.maintenanceMode).toBe(false);
			expect(data.cardPaymentsEnabled).toBe(false);
			expect(data.cryptoPaymentsEnabled).toBe(false);
			expect(data.paymentStatusAvailable).toBe(false);
			expect(data.usdcDepositConfigured).toBe(true);
		});
	});

	describe("POST /v1/deposit/usdc", () => {
		it("rejects invalid body (missing txHash) with 400", async () => {
			mockSelectReturns([{ cryptoPaymentsEnabled: true }]); // siteSettings check
			const res = await depositReq("post", "/v1/deposit/usdc", {
				amountUsd: 10,
				fromAddress: validFromAddress,
			});
			expect(res.status).toBe(400);
		});

		it("rejects amount below minimum with 400", async () => {
			mockSelectReturns([{ cryptoPaymentsEnabled: true }]);
			const res = await depositReq("post", "/v1/deposit/usdc", {
				amountUsd: 0.50, // $0.50 = 50 cents < min 100
				txHash: validTxHash,
				fromAddress: validFromAddress,
				challengeToken: validChallengeToken,
				signature: validSignature,
			});
			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.error.message).toContain("Minimum deposit");
		});

		it("rejects amount above maximum with 400", async () => {
			mockConfig.USDC_DEPOSIT_MAX_CENTS = 500; // $5.00 max for this test
			mockSelectReturns([{ cryptoPaymentsEnabled: true }]);
			const res = await depositReq("post", "/v1/deposit/usdc", {
				amountUsd: 10, // $10 = 1000 cents > 500 max
				txHash: validTxHash,
				fromAddress: validFromAddress,
				challengeToken: validChallengeToken,
				signature: validSignature,
			});
			expect(res.status).toBe(400);
			const data = await res.json();
			expect(data.error.message).toContain("Maximum deposit");
		});

		it("records a pending deposit and writes audit log", async () => {
			mockSelectReturns([{ cryptoPaymentsEnabled: true }]); // siteSettings
			mockDb.insert.mockReturnValueOnce({
				values: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([{ id: "dep_abc" }]),
				})),
			});

			const res = await depositReq("post", "/v1/deposit/usdc", {
				amountUsd: 10,
				txHash: validTxHash,
				fromAddress: validFromAddress,
				challengeToken: validChallengeToken,
				signature: validSignature,
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.depositId).toBe("dep_abc");
			expect(data.status).toBe("pending");
			expect(mockChallenge.verifyDepositChallenge).toHaveBeenCalled();
			expect(mockChallenge.verifyDepositSignature).toHaveBeenCalled();
			expect(auditLog).toHaveBeenCalledWith(
				expect.objectContaining({ action: "DEPOSIT_CREATED" }),
			);
		});

		it("handles duplicate txHash (23505 unique violation) gracefully", async () => {
			mockSelectReturns([{ cryptoPaymentsEnabled: true }]); // siteSettings
			const dupErr = Object.assign(new Error("duplicate"), { code: "23505" });
			mockDb.insert.mockReturnValueOnce({
				values: vi.fn(() => ({
					returning: vi.fn().mockRejectedValue(dupErr),
				})),
			});
			// The catch block does a select to find the existing row.
			mockSelectReturns([{ cryptoPaymentsEnabled: true }], [{
				id: "dep_existing",
				status: "pending",
				amountUsd: "10.00",
			}]);

			const res = await depositReq("post", "/v1/deposit/usdc", {
				amountUsd: 10,
				txHash: validTxHash,
				fromAddress: validFromAddress,
				challengeToken: validChallengeToken,
				signature: validSignature,
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.depositId).toBe("dep_existing");
			expect(data.message).toContain("already recorded");
		});

		it("rejects when wallet ownership proof fails (SECURITY: deposit Blocker)", async () => {
			mockSelectReturns([{ cryptoPaymentsEnabled: true }]); // siteSettings
			// Attacker submits a victim's txHash + victim's fromAddress but cannot
			// prove they own the sending wallet — signature recovery fails.
			mockChallenge.verifyDepositChallenge.mockReturnValueOnce({
				ok: true,
				payload: { userId: "user_1" },
			});
			mockChallenge.verifyDepositSignature.mockResolvedValueOnce(false);

			const res = await depositReq("post", "/v1/deposit/usdc", {
				amountUsd: 10,
				txHash: validTxHash,
				fromAddress: validFromAddress,
				challengeToken: validChallengeToken,
				signature: validSignature, // forged / from wrong wallet
			});
			expect(res.status).toBe(403);
			expect(mockDb.insert).not.toHaveBeenCalled();
		});

		it("rejects when the challenge token is invalid/expired (SECURITY)", async () => {
			mockSelectReturns([{ cryptoPaymentsEnabled: true }]);
			mockChallenge.verifyDepositChallenge.mockReturnValueOnce({
				ok: false,
				reason: "expired",
			});

			const res = await depositReq("post", "/v1/deposit/usdc", {
				amountUsd: 10,
				txHash: validTxHash,
				fromAddress: validFromAddress,
				challengeToken: validChallengeToken,
				signature: validSignature,
			});
			expect(res.status).toBe(403);
			expect(mockDb.insert).not.toHaveBeenCalled();
		});
	});

	describe("GET /v1/deposit/status", () => {
		it("returns deposit history", async () => {
			mockSelectReturns([{
				id: "dep_1",
				type: "usdc_direct",
				status: "completed",
				amountUsd: "10.00",
				creditsIssued: "1000",
				txHash: validTxHash,
				depositAddress: "0x0000000000000000000000000000000000000001",
				createdAt: new Date("2026-09-01T00:00:00Z"),
				completedAt: new Date("2026-09-01T00:01:00Z"),
			}]);
			const res = await depositReq("get", "/v1/deposit/status");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.deposits).toHaveLength(1);
			expect(data.deposits[0].id).toBe("dep_1");
			expect(data.deposits[0].status).toBe("completed");
		});
	});
});
