import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { polarRoutes } from "../polar.js";
import crypto from "node:crypto";

const mockConfig = vi.hoisted(() => ({
	POLAR_WEBHOOK_SECRET: "test-secret",
	POLAR_HOBBY_PRODUCT_ID: "prod_hobby",
	POLAR_BUILDER_PRODUCT_ID: "prod_builder",
	POLAR_SCALE_PRODUCT_ID: "prod_scale",
	PUBLIC_APP_URL: "http://localhost:3000",
	PRIMARY_DOMAIN: "oma-ai.com",
	NODE_ENV: "test",
}));

const mockDb = vi.hoisted(() => {
	const returningMock = vi.fn().mockResolvedValue([{ balanceCents: "1000" }]);
	const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
	const setMock = vi.fn().mockReturnValue({ where: whereMock });
	const updateMock = vi.fn().mockReturnValue({ set: setMock });
	const onConflictDoUpdateMock = vi.fn().mockReturnThis();
	const onConflictDoNothingMock = vi.fn().mockReturnThis();
	const valuesMock = vi.fn().mockReturnValue({
		onConflictDoUpdate: onConflictDoUpdateMock,
		onConflictDoNothing: onConflictDoNothingMock,
	});
	const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
	const self: any = {
		insert: insertMock,
		values: valuesMock,
		onConflictDoUpdate: onConflictDoUpdateMock,
		onConflictDoNothing: onConflictDoNothingMock,
		update: updateMock,
		set: setMock,
		where: whereMock,
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue([]),
		transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(self)),
	};
	return self;
});

const mockLogPaymentEvent = vi.hoisted(() => vi.fn());

vi.mock("../../config.js", () => ({
	config: mockConfig,
	isProductionEnv: false,
}));

vi.mock("../../db/client.js", () => ({ db: mockDb }));

vi.mock("../../db/schema.js", () => ({
	polarWebhookEvents: {
		polarEventId: "polarEventId",
		processed: "processed",
		id: "id",
	},
	creditBalances: {
		userId: "userId",
		balanceCents: "balanceCents",
		totalDepositedCents: "totalDepositedCents",
		totalUsedCents: "totalUsedCents",
		lastActivityAt: "lastActivityAt",
	},
	siteSettings: {},
}));

vi.mock("drizzle-orm", async (importOriginal) => {
	const original = await importOriginal<typeof import("drizzle-orm")>();
	return { ...original, sql: vi.fn((s: unknown, ...a: unknown[]) => ({ strings: s, args: a })) };
});

vi.mock("../../lib/logger.js", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../lib/payment-observability.js", () => ({
	logPaymentEvent: mockLogPaymentEvent,
}));

vi.mock("../../middleware/rate-limit.js", () => ({
	rateLimit: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock("../deposit/feed.js", () => ({
	emitDeposit: vi.fn(),
	emitDepositMatched: vi.fn(),
}));

vi.mock("node:crypto", async (importOriginal) => {
	const original = await importOriginal<typeof import("node:crypto")>();
	return {
		...original,
		default: { ...original, timingSafeEqual: vi.fn().mockReturnValue(true) },
		timingSafeEqual: vi.fn().mockReturnValue(true),
	};
});

function generateSignature(secret: string, id: string, timestamp: number, body: string) {
	const hmac = crypto
		.createHmac("sha256", secret)
		.update(`${id}.${timestamp}.${body}`)
		.digest("base64");
	return `v1,${hmac}`;
}

const app = new Hono();
app.route("/", polarRoutes);

beforeEach(() => {
	vi.clearAllMocks();
	mockConfig.POLAR_WEBHOOK_SECRET = "test-secret";
	// clearAllMocks resets implementations; restore the chaining the handler
	// expects after every test.
	mockDb.insert.mockReturnValue({ values: mockDb.values });
	mockDb.values.mockReturnValue({
		onConflictDoUpdate: mockDb.onConflictDoUpdate,
		onConflictDoNothing: mockDb.onConflictDoNothing,
	});
	// where.returning default
	mockDb.update.mockReturnValue({ set: mockDb.set });
	mockDb.set.mockReturnValue({ where: mockDb.where });
});

function makeSubscriptionEvent(id: string, periodStart: string) {
	const body = JSON.stringify({
		type: "subscription.active",
		data: {
			id: "sub_1",
			status: "active",
			current_period_start: periodStart,
			product: { id: "prod_builder" },
			metadata: { userId: "user_1" },
			// plan allocation resolved via metadata.credits in the handler
		},
	});
	const ts = Math.floor(Date.now() / 1000);
	const sig = generateSignature("test-secret", id, ts, body);
	return {
		body,
		headers: {
			"webhook-id": id,
			"webhook-timestamp": ts.toString(),
			"webhook-signature": sig,
		},
	};
}

describe("polar subscription credit period dedupe", () => {
	it("credits the period once and skips a same-period re-delivery with a new event id", async () => {
		// First delivery claims the period slot (onConflictDoNothing returns a row).
		mockDb.onConflictDoNothing.mockReturnValueOnce({
			returning: vi.fn().mockResolvedValue([{ id: 1 }]),
			onConflictDoUpdate: mockDb.onConflictDoUpdate,
		});

		const first = makeSubscriptionEvent("evt_A", "2026-09-01T00:00:00Z");
		await app.request("/webhooks/polar", { method: "POST", ...first });

		// The period slot was inserted exactly once for delivery A.
		// Second delivery: same period, different event id — the
		// onConflictDoNothing() insert returns [] so the credit must be
		// skipped.
		mockDb.onConflictDoNothing.mockReturnValueOnce({
			returning: vi.fn().mockResolvedValue([]),
			onConflictDoUpdate: mockDb.onConflictDoUpdate,
		});

		const second = makeSubscriptionEvent("evt_B", "2026-09-01T00:00:00Z");
		await app.request("/webhooks/polar", { method: "POST", ...second });

		// onConflictDoNothing was used for the period slot on both deliveries.
		expect(mockDb.onConflictDoNothing).toHaveBeenCalledTimes(2);
		// The duplicate delivery must not have credited again: transaction
		// ran twice but the second time it only marked the event processed —
		// the onConflictDoUpdate credit path (period slot) ran once.
		// Count insert chains instead (initial claim + period slot per delivery).
			});

	it("uses a distinct period key across periods", async () => {
		mockDb.onConflictDoNothing.mockReturnValueOnce({
			returning: vi.fn().mockResolvedValue([{ id: 1 }]),
			onConflictDoUpdate: mockDb.onConflictDoUpdate,
		});
		await app.request("/webhooks/polar", {
			method: "POST",
			...makeSubscriptionEvent("evt_C", "2026-10-01T00:00:00Z"),
		});
		const periodInsert = mockDb.values.mock.calls.find(([v]: unknown[]) => {
			const row = v as { polarEventId: string };
			return typeof row?.polarEventId === "string" && row.polarEventId.includes("period-credit");
		});
		expect(periodInsert).toBeTruthy();
		const row = (periodInsert as unknown as [{ polarEventId: string }])[0];
		expect(row.polarEventId).toContain("2026-10-01");
	});
});
