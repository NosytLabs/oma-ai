/**
 * Tests for /v1/credits/* routes (balance and transactions).
 *
 * Covers the two endpoints exposed by credits.ts:
 *   GET  /v1/credits/balance       — active batches + aggregate balance
 *   GET  /v1/credits/transactions  — combined deposit + usage history
 *
 * Auth middleware is stubbed to set userId="user_1". DB is mocked per-test.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
vi.mock("../../lib/credit-holds.js", () => ({ readCreditHoldTotals: async () => ({ reservedCents: "0", reconciliationCents: "0" }) }));

// ─── Mocks ──────────────────────────────────────────────────────────────────

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

		it.each([
			["-0.00000001", "0.00000001"],
			["-9007199254740993.12345678", "9007199254740993.12345678"],
		])("keeps refunded balance %s out of spendable credits with exact debt", async (balanceCents, debtCents) => {
			mockSelectReturns([], [{ balanceCents }]);
			const res = await creditRequest("get", "/v1/credits/balance");
			expect(res.status).toBe(200);
			expect(await res.json()).toMatchObject({ balanceCents: "0", debtCents, activeBatches: [] });
		});

		it("omits debt from an ordinary positive balance", async () => {
			mockSelectReturns([], [{ balanceCents: "0.00000001" }]);
			const data = await (await creditRequest("get", "/v1/credits/balance")).json();
			expect(data.balanceCents).toBe("0.00000001");
			expect(data).not.toHaveProperty("debtCents");
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
			expect(data.transactions[0].amountCents).toBe(-50);
			expect(data.transactions[1].type).toBe("deposit");
		});

		it("rejects limit > 200 with 400", async () => {
			const res = await creditRequest("get", "/v1/credits/transactions?limit=999");
			expect(res.status).toBe(400);
		});

		it("includes a recent refund even when its original request is outside recent history", async () => {
			mockSelectReturns([], [], [{ id: "old-request", totalCents: "0.000006", model: "minimax-m2-7", refundedAt: new Date("2026-10-10T22:00:00Z") }]);
			const res = await creditRequest("get", "/v1/credits/transactions?limit=5");
			expect((await res.json()).transactions).toEqual([expect.objectContaining({ id: "old-request-refund", type: "refund", amountCents: 0.000006 })]);
		});
	});

});
