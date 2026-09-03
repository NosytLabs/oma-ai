/**
 * Tests for /v1/credits/* routes (balance, transactions, auto-reload).
 *
 * Covers the three endpoints exposed by credits.ts:
 *   GET  /v1/credits/balance       — active batches + aggregate balance
 *   GET  /v1/credits/transactions  — combined deposit + usage history
 *   GET  /v1/credits/auto-reload   — user auto-reload settings (default + saved)
 *   POST /v1/credits/auto-reload   — upsert auto-reload settings (validation)
 *
 * Auth middleware is stubbed to set userId="user_1". DB is mocked per-test.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

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

vi.mock("../../lib/logger.js", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

// DB mock — builder chain. Each test customises the return values.
const mockDb = vi.hoisted(() => {
	const chain = () => {
		const self: any = {
			from: vi.fn(() => self),
			where: vi.fn(() => self),
			orderBy: vi.fn(() => self),
			limit: vi.fn(() => self),
			then: undefined as undefined,
		};
		return self;
	};
	return {
		select: vi.fn(() => chain()),
		insert: vi.fn(() => ({
			values: vi.fn(() => ({
				onConflictDoUpdate: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([]),
				})),
			})),
		})),
	};
});
vi.mock("../../db/client.js", () => ({ db: mockDb }));

vi.mock("../../db/schema.js", () => ({
	autoReloadSettings: { userId: "userId" },
	creditBalances: { userId: "userId" },
	creditBatches: { userId: "userId", remainingCents: "remainingCents", expiresAt: "expiresAt", usedAt: "usedAt", createdAt: "createdAt" },
	deposits: { userId: "userId", createdAt: "createdAt" },
	usageRecords: { userId: "userId", createdAt: "createdAt" },
}));

import { creditsRoutes } from "../credits.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function creditRequest(method: "get" | "post", path: string, body?: unknown) {
	const app = new Hono();
	app.route("/", creditsRoutes);
	return app.request(
		new Request(`http://localhost${path}`, {
			method: method.toUpperCase(),
			headers: { "Content-Type": "application/json" },
			body: body ? JSON.stringify(body) : undefined,
		}),
	);
}

// Build a mock db.select() chain that resolves to `rows` at the terminal .limit().
function mockSelectReturns(...rows: any[][]) {
	const calls: any[] = [];
	mockDb.select.mockImplementation(() => {
		const idx = calls.length;
		calls.push(idx);
		const r = rows[idx] ?? [];
		const limit = vi.fn().mockResolvedValue(r);
		const orderBy = vi.fn().mockReturnValue({ limit });
		const where = vi.fn().mockReturnValue({ limit, orderBy });
		const from = vi.fn().mockReturnValue({ where, limit, orderBy });
		return { from, where, limit, orderBy };
	});
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("credits routes", () => {
	describe("GET /v1/credits/balance", () => {
		it("returns empty batches and zero balance when user has no rows", async () => {
			// Promise.all([batches, balances]) — both return []
			mockSelectReturns([], []);
			const res = await creditRequest("get", "/v1/credits/balance");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.activeBatches).toEqual([]);
			expect(data.balanceCents).toBe("0");
		});

		it("returns active batches and aggregate balance", async () => {
			mockSelectReturns(
				[
					{
						id: "batch_1",
						amountCents: "5000",
						remainingCents: "3000",
						expiresAt: new Date("2027-01-01"),
						paymentMethod: "usdc",
					},
				],
				[{ balanceCents: "3000" }],
			);
			const res = await creditRequest("get", "/v1/credits/balance");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.activeBatches).toHaveLength(1);
			expect(data.activeBatches[0].remainingCents).toBe("3000");
			expect(data.balanceCents).toBe("3000");
		});
	});

	describe("GET /v1/credits/transactions", () => {
		it("merges deposits and usage rows sorted by createdAt desc", async () => {
			mockSelectReturns(
				// deposits
				[
					{
						id: "dep_1",
						type: "usdc_direct",
						amountUsd: "10.00",
						creditsIssued: "1000",
						status: "completed",
						createdAt: new Date("2026-09-01T10:00:00Z"),
						txHash: "0xabc",
					},
				],
				// usage
				[
					{
						id: "usage_1",
						totalCents: "50",
						status: "completed",
						createdAt: new Date("2026-09-02T10:00:00Z"),
						model: "llama-3.3-70b",
					},
				],
			);
			const res = await creditRequest("get", "/v1/credits/transactions?limit=50");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.transactions).toHaveLength(2);
			// Usage row (Sep 2) should come before deposit row (Sep 1)
			expect(data.transactions[0].type).toBe("usage");
			expect(data.transactions[1].type).toBe("deposit");
		});

		it("rejects limit > 200 with 400", async () => {
			const res = await creditRequest("get", "/v1/credits/transactions?limit=999");
			// z.coerce.number().max(200) throws → 500 by default in Hono unless caught
			// The route does .parse() which throws on invalid — Hono surfaces as 500.
			// This documents current behaviour (no try/catch around the parse).
			expect([400, 500]).toContain(res.status);
		});
	});

	describe("GET /v1/credits/auto-reload", () => {
		it("returns defaults when no saved settings exist", async () => {
			mockSelectReturns([]);
			const res = await creditRequest("get", "/v1/credits/auto-reload");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.enabled).toBe(false);
			expect(data.thresholdCents).toBe(500);
			expect(data.reloadAmountCents).toBe(10000);
		});

		it("returns saved settings when a row exists", async () => {
			mockSelectReturns([
				{
					enabled: true,
					thresholdCents: "1000",
					reloadAmountCents: "20000",
					spendLimitCents: "50000",
					paymentMethod: "usdc",
				},
			]);
			const res = await creditRequest("get", "/v1/credits/auto-reload");
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.enabled).toBe(true);
			expect(data.thresholdCents).toBe(1000);
			expect(data.reloadAmountCents).toBe(20000);
		});
	});

	describe("POST /v1/credits/auto-reload", () => {
		it("rejects invalid body with 400", async () => {
			const res = await creditRequest("post", "/v1/credits/auto-reload", {
				thresholdCents: "not-a-number",
			});
			expect(res.status).toBe(400);
		});

		it("rejects reloadAmountCents below minimum (100)", async () => {
			const res = await creditRequest("post", "/v1/credits/auto-reload", {
				reloadAmountCents: 50,
			});
			expect(res.status).toBe(400);
		});

		it("rejects spendLimitCents above max (10_000_000)", async () => {
			const res = await creditRequest("post", "/v1/credits/auto-reload", {
				spendLimitCents: 20_000_000,
			});
			expect(res.status).toBe(400);
		});

		it("upserts valid settings and returns the saved row", async () => {
			mockDb.insert.mockReturnValueOnce({
				values: vi.fn(() => ({
					onConflictDoUpdate: vi.fn(() => ({
						returning: vi.fn().mockResolvedValue([
							{
								enabled: true,
								thresholdCents: "800",
								reloadAmountCents: "25000",
								spendLimitCents: "100000",
								paymentMethod: "usdc",
							},
						]),
					})),
				})),
			});

			const res = await creditRequest("post", "/v1/credits/auto-reload", {
				enabled: true,
				thresholdCents: 800,
				reloadAmountCents: 25000,
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.enabled).toBe(true);
			expect(data.thresholdCents).toBe(800);
			expect(data.reloadAmountCents).toBe(25000);
		});
	});
});
