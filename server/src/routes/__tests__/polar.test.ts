import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { polarRoutes, isAllowedCheckoutOrigin } from "../polar.js";
import crypto from "node:crypto";

const mockConfig = vi.hoisted(() => ({
	POLAR_ACCESS_TOKEN: "polar_test_token",
	POLAR_WEBHOOK_SECRET: "test-secret",
	POLAR_HOBBY_PRODUCT_ID: "prod_hobby",
	POLAR_BUILDER_PRODUCT_ID: "prod_builder",
	POLAR_SCALE_PRODUCT_ID: "prod_scale",
	PUBLIC_APP_URL: "http://localhost:3000",
	PRIMARY_DOMAIN: "oma-ai.com",
	NODE_ENV: "test"
}));

vi.mock("@polar-sh/sdk/2026-10", () => ({ createPolar: () => ({ checkouts: { create: async () => ({ id: "checkout-test", url: "https://checkout.example.test" }) } }) }));

const mockDb = vi.hoisted(() => {
	const limitMock = vi.fn().mockReturnThis();
	const whereMock = vi.fn().mockReturnThis();
	// drainUserTx now reads the post-drain balance via
	// update().set().where().returning(), so the chain must terminate in a
	// `returning` mock instead of `this`.
	const returningMock = vi.fn().mockResolvedValue([{ balanceCents: "0" }]);
	whereMock.mockReturnValue({ returning: returningMock });
	const setMock = vi.fn().mockReturnValue({ where: whereMock });
	const updateMock = vi.fn().mockReturnValue({ set: setMock });
	const onConflictDoUpdateMock = vi.fn().mockReturnThis();
	const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
	const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
	const selectMock = vi.fn().mockReturnThis();
	const fromMock = vi.fn().mockReturnThis();
	// SECURITY (audit 2.2): the route now wraps credit + processed-flag
	// updates in `db.transaction`. The transaction receives a tx that
	// exposes the same insert/update surface as the top-level db. Inside
	// the callback we forward to the same chained mocks so call counts
	// stay comparable across tests.
	const transactionMock = vi.fn(async (fn: (tx: typeof mockDb) => Promise<void>) =>
		fn(mockDb),
	);

	return {
		insert: insertMock,
		values: valuesMock,
		onConflictDoUpdate: onConflictDoUpdateMock,
		update: updateMock,
		set: setMock,
		where: whereMock,
		select: selectMock,
		from: fromMock,
		limit: limitMock,
		transaction: transactionMock,
	};
});

const mockLogPaymentEvent = vi.hoisted(() => vi.fn());
const mockEmitDepositMatched = vi.hoisted(() => vi.fn());

vi.mock("../../config.js", () => ({
	config: mockConfig,
	isProductionEnv: mockConfig.NODE_ENV !== "test" ? true : false,
}));

vi.mock("../../db/client.js", () => ({
	db: mockDb,
}));

vi.mock("../../db/schema.js", () => ({
	// `processed` must be present: the resume path reads
	// polarWebhookEvents.processed to tell a genuine replay (processed=1)
	// from a previously-failed event (processed=0). Without this column the
	// handler saw undefined and both cases behaved identically, so the
	// regression test could not fail.
	polarWebhookEvents: { polarEventId: "polarEventId", processed: "processed" },
	creditBalances: { userId: "userId", balanceCents: "balanceCents", totalDepositedCents: "totalDepositedCents" },
	siteSettings: {}
}));

vi.mock("drizzle-orm", async (importOriginal) => {
	const original = await importOriginal<typeof import("drizzle-orm")>();
	return {
		...original,
		sql: vi.fn((strings, ...args) => ({ strings, args }))
	};
});

vi.mock("../../lib/logger.js", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}
}));

// We need to properly intercept the module where `logPaymentEvent` is defined
vi.mock("../../lib/payment-observability.js", () => ({
	logPaymentEvent: mockLogPaymentEvent
}));

// MOCK THE FEED SO IT DOESNT FAIL OR USE REAL IMPLEMENTATION
vi.mock("../deposit/feed.js", () => ({
	emitDepositMatched: mockEmitDepositMatched
}));

vi.mock("../../auth/middleware.js", () => ({
	sessionOrBearerAuth: vi.fn(async (c, next) => {
		c.set("userId", "test-user");
		return next();
	}),
}));

// Route behavior is the subject of this suite; Redis-backed throttling is not.
// Leaving the real middleware mounted makes every request wait for Redis and
// turns an infrastructure timeout into an unrelated 503 assertion failure.
vi.mock("../../middleware/rate-limit.js", () => ({
	rateLimit: vi.fn(
		() => async (_c: unknown, next: () => Promise<void>) => next(),
	),
}));

// Add timingSafeEqual mock before using
vi.mock("node:crypto", async (importOriginal) => {
	const original = await importOriginal<typeof import("node:crypto")>();
	return {
		...original,
		default: {
			...original,
			timingSafeEqual: vi.fn().mockReturnValue(true)
		},
		timingSafeEqual: vi.fn().mockReturnValue(true)
	};
});

function generateSignature(secret: string, id: string, timestamp: number, body: string) {
	const hmac = crypto.createHmac("sha256", secret)
		.update(`${id}.${timestamp}.${body}`)
		.digest("base64");
	return `v1,${hmac}`;
}

describe("polar routes", () => {
	const app = new Hono();
	app.route("/", polarRoutes);

	beforeEach(() => {
		vi.clearAllMocks();
		// The missing-secret case mutates this shared hoisted object. Restore the
		// configured default before every test so order and failure paths cannot
		// leak a 503 state into the rest of the suite.
		mockConfig.POLAR_WEBHOOK_SECRET = "test-secret";
	});

	it("refuses checkout when the operator's payment settings are unreachable", async () => {
		mockDb.limit.mockRejectedValueOnce(new Error("private database connection failure"));
		const response = await app.request("/v1/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "hobby" }) });
		expect(response.status).toBe(503);
		expect(await response.text()).not.toMatch(/private database connection/);
	});

	describe("POST /webhooks/polar", () => {
		it("rejects if POLAR_WEBHOOK_SECRET is not configured", async () => {
			const originalSecret = mockConfig.POLAR_WEBHOOK_SECRET;
			mockConfig.POLAR_WEBHOOK_SECRET = "";
			
			const res = await app.request("/webhooks/polar", {
				method: "POST",
				body: "{}"
			});
			
			expect(res.status).toBe(503);
			mockConfig.POLAR_WEBHOOK_SECRET = originalSecret;
		});

		it("rejects missing signature headers", async () => {
			const res = await app.request("/webhooks/polar", {
				method: "POST",
				body: "{}"
			});
			
			expect(res.status).toBe(401);
		});

		it("rejects invalid signature", async () => {
			// Override the timingSafeEqual specifically for this test
			vi.mocked(crypto.timingSafeEqual).mockReturnValueOnce(false);
			const body = JSON.stringify({ type: "test" });
			const id = "evt_123";
			const ts = Math.floor(Date.now() / 1000).toString();
			
			const res = await app.request("/webhooks/polar", {
				method: "POST",
				body,
				headers: {
					"webhook-id": id,
					"webhook-timestamp": ts,
					"webhook-signature": "v1,invalid-sig"
				}
			});
			
			expect(res.status).toBe(401);
		});

		it("rejects invalid JSON", async () => {
			const body = "{ invalid json }";
			const id = "evt_123";
			const ts = Math.floor(Date.now() / 1000);
			const sig = generateSignature("test-secret", id, ts, body);
			
			const res = await app.request("/webhooks/polar", {
				method: "POST",
				body,
				headers: {
					"webhook-id": id,
					"webhook-timestamp": ts.toString(),
					"webhook-signature": sig
				}
			});
			
			expect(res.status).toBe(400);
		});

		it("handles duplicate event (double-spend protection)", async () => {
			const body = JSON.stringify({ type: "order.paid" });
			const id = "evt_123";
			const ts = Math.floor(Date.now() / 1000);
			const sig = generateSignature("test-secret", id, ts, body);

			// Simulate unique constraint violation
			const err = new Error("duplicate") as any;
			err.code = "23505";
			mockDb.values.mockRejectedValueOnce(err);
			// An ALREADY-PROCESSED row: a genuine replay. The handler must
			// short-circuit and must NOT credit a second time.
			mockDb.select.mockReturnValueOnce({
				from: () => ({
					where: () => ({
						limit: async () => [{ processed: 1 }],
					}),
				}),
			});

			const res = await app.request("/webhooks/polar", {
				method: "POST",
				body,
				headers: {
					"webhook-id": id,
					"webhook-timestamp": ts.toString(),
					"webhook-signature": sig
				}
			});

			expect(res.status).toBe(200);
			const data = await res.json() as { duplicate: boolean };
			expect(data.duplicate).toBe(true);
			expect(mockLogPaymentEvent).toHaveBeenCalledWith(expect.objectContaining({ outcome: "double_spend_blocked" }));
		});

		it("RESUMES a previously-failed event instead of dropping the credit", async () => {
			// REGRESSION (audit HIGH): the row is claimed and committed with
			// processed=0 BEFORE the credit transaction runs. If that
			// transaction then failed (DB blip, timeout, crash), the row stayed
			// at processed=0. The old code treated ANY unique-constraint
			// collision as a duplicate and returned 200, so every Polar retry
			// was swallowed and the customer was NEVER credited — permanently,
			// with no repair path. A processed=0 row must be resumed.
			const body = JSON.stringify({
				type: "order.paid",
				data: {
					product: { id: "prod_hobby" },
					metadata: { userId: "user_1" },
				},
			});
			const id = "evt_resume";
			const ts = Math.floor(Date.now() / 1000);
			const sig = generateSignature("test-secret", id, ts, body);

			const err = new Error("duplicate") as any;
			err.code = "23505";
			mockDb.values.mockRejectedValueOnce(err);
			// processed=0 => a previous attempt claimed but never completed.
			mockDb.select.mockReturnValueOnce({
				from: () => ({
					where: () => ({
						limit: async () => [{ processed: 0 }],
					}),
				}),
			});

			const res = await app.request("/webhooks/polar", {
				method: "POST",
				body,
				headers: {
					"webhook-id": id,
					"webhook-timestamp": ts.toString(),
					"webhook-signature": sig
				}
			});

			expect(res.status).toBe(200);
			// Must NOT be reported as a duplicate — that was the money bug.
			const data = await res.json() as { duplicate?: boolean };
			expect(data.duplicate).toBeUndefined();
			// The credit must actually have been re-attempted.
			expect(mockDb.transaction).toHaveBeenCalled();
		});

		it("processes order.paid successfully and credits user", async () => {
			// Pass `product.id` so `planFromProductId` can resolve a plan — the
			// webhook handler no longer trusts metadata.credits (security fix).
			// Test product id maps to "builder" via mockConfig.POLAR_BUILDER_PRODUCT_ID.
			const body = JSON.stringify({
				type: "order.paid",
				data: {
					product: { id: "prod_builder" },
					metadata: { userId: "user_123", credits: 5000 }
				}
			});
			const id = "evt_456";
			const ts = Math.floor(Date.now() / 1000);
			const sig = generateSignature("test-secret", id, ts, body);

			const res = await app.request("/webhooks/polar", {
				method: "POST",
				body,
				headers: {
					"webhook-id": id,
					"webhook-timestamp": ts.toString(),
					"webhook-signature": sig
				}
			});

			expect(res.status).toBe(200);
			// Verify db insert values (polarWebhookEvents + credit balance)
			expect(mockDb.insert).toHaveBeenCalledTimes(2);
			expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
				polarEventId: id,
				eventType: "order.paid"
			}));
			// Verify user was credited with the plan-derived amount (5000)
			expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
				userId: "user_123",
				balanceCents: "5000"
			}));
			expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
		});

		it("processes order.refunded successfully and drains user", async () => {
			const body = JSON.stringify({
				type: "order.refunded",
				data: {
					product: { id: "prod_builder" },
					metadata: { userId: "user_123", credits: 5000 }
				}
			});
			const id = "evt_789";
			const ts = Math.floor(Date.now() / 1000);
			const sig = generateSignature("test-secret", id, ts, body);
			
			const res = await app.request("/webhooks/polar", {
				method: "POST",
				body,
				headers: {
					"webhook-id": id,
					"webhook-timestamp": ts.toString(),
					"webhook-signature": sig
				}
			});
			
			expect(res.status).toBe(200);
			// Only the event row is INSERTed now. The drain was changed from an
			// insert-on-conflict upsert to a guarded UPDATE that reads back the
			// post-drain balance, so it shows up in update(), not insert().
			expect(mockDb.insert).toHaveBeenCalledTimes(1);
			// GREATEST(balance - credits, 0) means a refund can never overdraw.
			expect(mockDb.update).toHaveBeenCalled();
			expect(mockDb.set).toHaveBeenCalled();
		});
	});

	describe("checkout successUrl origin allow-list (open-redirect fix)", () => {
		it("allows the app's own production origin (www + apex) always", () => {
			// Prod app domains are honoured in every environment.
			expect(isAllowedCheckoutOrigin("https://www.oma-ai.com/dashboard?deposit=success")).toBe(true);
			expect(isAllowedCheckoutOrigin("https://oma-ai.com/dashboard?deposit=success")).toBe(true);
		});

		it("allows localhost success URLs only outside production (dev/test)", () => {
			// Under NODE_ENV=test (the suite's env), isProductionEnv is false and
			// localhost stays permitted for local checkout redirects. In a
			// production run the same helper rejects localhost — see the guard in
			// isAllowedCheckoutOrigin (`&& !isProductionEnv`).
			expect(isAllowedCheckoutOrigin("http://localhost:3000/dashboard?deposit=success")).toBe(true);
			expect(isAllowedCheckoutOrigin("http://localhost:3002/dashboard?deposit=success")).toBe(true);
		});

		it("rejects attacker-controlled origins (open-redirect closed)", () => {
			expect(isAllowedCheckoutOrigin("https://evil.example.com/dashboard")).toBe(false);
			expect(isAllowedCheckoutOrigin("https://www.oma-ai.com.evil.com/dashboard")).toBe(false);
			expect(isAllowedCheckoutOrigin("https://oma-ai.com.attacker.io/phish")).toBe(false);
			expect(isAllowedCheckoutOrigin("javascript:alert(1)")).toBe(false);
			expect(isAllowedCheckoutOrigin("not-a-url")).toBe(false);
		});
	});
});
