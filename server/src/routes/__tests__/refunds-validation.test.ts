/**
 * Refund-route schema + envelope helper tests.
 *
 * Imports the SAME schemas the route handlers ship with, so a
 * constraint change in routes/refunds.ts or routes/admin-refunds.ts
 * is tested automatically — no mirror drift. The prior
 * `refunds-validation.test.ts` copy-pasted the schemas, so the test
 * could pass while prod broke.
 */
import { describe, expect, it } from "vitest";
import {
	createRefundSchema,
	decideRefundSchema,
	decodeEnvelope,
	encodeEnvelope,
	listAdminRefundsSchema,
	listRefundsSchema,
} from "../_refund-schemas";

describe("createRefundSchema (POST /v1/refunds body)", () => {
	it("accepts a valid usageId (UUID), reason (10–1000), optional amountCents", () => {
		expect(
			createRefundSchema.safeParse({
				usageId: "11111111-1111-4111-8111-111111111111",
				reason: "I forgot I had a subscription",
				amountCents: 1,
			}).success,
		).toBe(true);
	});

	it("accepts a missing amountCents (treated as 'full unrefunded portion')", () => {
		expect(
			createRefundSchema.safeParse({
				usageId: "11111111-1111-4111-8111-111111111111",
				reason: "outage during this request",
			}).success,
		).toBe(true);
	});

	it("rejects a non-UUID usageId", () => {
		expect(
			createRefundSchema.safeParse({
				usageId: "not-a-uuid",
				reason: "looks long enough to satisfy the reason minimum",
			}).success,
		).toBe(false);
	});

	it("rejects a reason shorter than 10 characters", () => {
		expect(
			createRefundSchema.safeParse({
				usageId: "11111111-1111-4111-8111-111111111111",
				reason: "too short",
			}).success,
		).toBe(false);
	});

	it("rejects a reason longer than 1000 characters", () => {
		expect(
			createRefundSchema.safeParse({
				usageId: "11111111-1111-4111-8111-111111111111",
				reason: "x".repeat(1001),
			}).success,
		).toBe(false);
	});

	it("rejects a non-positive or non-finite amountCents", () => {
		for (const bad of [0, -1, -100, NaN, Infinity]) {
			expect(
				createRefundSchema.safeParse({
					usageId: "11111111-1111-4111-8111-111111111111",
					reason: "reasonable refund request reason",
					amountCents: bad,
				}).success,
				`amountCents=${bad}`,
			).toBe(false);
		}
	});

	it("rejects a missing required field (usageId or reason)", () => {
		expect(createRefundSchema.safeParse({ reason: "long enough" }).success).toBe(false);
		expect(
			createRefundSchema.safeParse({ usageId: "11111111-1111-4111-8111-111111111111" })
				.success,
		).toBe(false);
	});
});

describe("decideRefundSchema (POST /v1/admin/refunds body)", () => {
	it("accepts a granted decision with an optional admin note", () => {
		expect(
			decideRefundSchema.safeParse({
				id: "11111111-1111-4111-8111-111111111111",
				decision: "granted",
				adminNote: "Confirmed outage during the request; full refund approved.",
			}).success,
		).toBe(true);
	});

	it("accepts a denied decision without an admin note", () => {
		expect(
			decideRefundSchema.safeParse({
				id: "11111111-1111-4111-8111-111111111111",
				decision: "denied",
			}).success,
		).toBe(true);
	});

	it("rejects a decision value that is not 'granted' or 'denied'", () => {
		for (const bad of ["approved", "issued", "GRANTED", "", "refunded"]) {
			expect(
				decideRefundSchema.safeParse({
					id: "11111111-1111-4111-8111-111111111111",
					decision: bad,
				}).success,
				`decision=${bad}`,
			).toBe(false);
		}
	});

	it("rejects a non-UUID id", () => {
		expect(
			decideRefundSchema.safeParse({
				id: "11111111",
				decision: "granted",
			}).success,
		).toBe(false);
	});

	it("rejects an adminNote over 1000 chars (let the handler log it without storing garbage)", () => {
		expect(
			decideRefundSchema.safeParse({
				id: "11111111-1111-4111-8111-111111111111",
				decision: "denied",
				adminNote: "x".repeat(1001),
			}).success,
		).toBe(false);
	});
});

describe("listRefundsSchema + listAdminRefundsSchema (GET query)", () => {
	it("accepts an empty query and defaults limit=50", () => {
		const r1 = listRefundsSchema.safeParse({});
		expect(r1.success).toBe(true);
		if (r1.success) expect(r1.data.limit).toBe(50);

		const r2 = listAdminRefundsSchema.safeParse({});
		expect(r2.success).toBe(true);
		if (r2.success) expect(r2.data.limit).toBe(50);
	});

	it("rejects limit below 1 or above 200", () => {
		for (const bad of [0, -1, 201, 9999]) {
			expect(
				listRefundsSchema.safeParse({ limit: bad }).success,
				`limit=${bad}`,
			).toBe(false);
			expect(
				listAdminRefundsSchema.safeParse({ limit: bad }).success,
				`admin limit=${bad}`,
			).toBe(false);
		}
	});

	it("rejects a status value not in pending/granted/denied", () => {
		expect(
			listRefundsSchema.safeParse({ status: "approved" }).success,
		).toBe(false);
		expect(
			listAdminRefundsSchema.safeParse({ status: "approved" }).success,
		).toBe(false);
	});

	it("accepts each valid status", () => {
		for (const s of ["pending", "granted", "denied"]) {
			expect(
				listRefundsSchema.safeParse({ status: s }).success,
				`status=${s}`,
			).toBe(true);
			expect(
				listAdminRefundsSchema.safeParse({ status: s }).success,
				`admin status=${s}`,
			).toBe(true);
		}
	});
});

describe("encodeEnvelope / decodeEnvelope (refund_requests.notes column)", () => {
	it("round-trips a usageId-only envelope", () => {
		const e = encodeEnvelope({ u: "11111111-1111-4111-8111-111111111111" });
		const d = decodeEnvelope(e);
		expect(d.usageId).toBe("11111111-1111-4111-8111-111111111111");
		expect(d.adminNote).toBe(null);
	});

	it("round-trips a usageId + adminNote envelope", () => {
		const e = encodeEnvelope({
			u: "11111111-1111-4111-8111-111111111111",
			n: "Approved by jane@oma-ai",
		});
		const d = decodeEnvelope(e);
		expect(d.usageId).toBe("11111111-1111-4111-8111-111111111111");
		expect(d.adminNote).toBe("Approved by jane@oma-ai");
	});

	it("round-trips an empty envelope (both fields null)", () => {
		const e = encodeEnvelope({});
		const d = decodeEnvelope(e);
		expect(d.usageId).toBe(null);
		expect(d.adminNote).toBe(null);
	});

	it("uses stable key order so equal envelopes produce equal strings (hashable / dedupable)", () => {
		const a = encodeEnvelope({ u: "x", n: "y" });
		const b = encodeEnvelope({ u: "x", n: "y" });
		// Critical for any future dedup-index that uses `notes` as a unique
		// key. Insertion order is stable in V8, so both must match.
		expect(a).toBe(b);
		// And the order is the one the route relies on: u first, n second.
		expect(a).toBe(`{"u":"x","n":"y"}`);
	});

	it("decodes a legacy non-JSON string as a raw usageId (back-compat for old rows)", () => {
		const d = decodeEnvelope("raw-uuid-from-old-format-7e57-1111");
		expect(d.usageId).toBe("raw-uuid-from-old-format-7e57-1111");
		expect(d.adminNote).toBe(null);
	});

	it("decodes a null notes column as both-null", () => {
		const d = decodeEnvelope(null);
		expect(d).toEqual({ usageId: null, adminNote: null });
	});

	it("decodes a partial envelope (only adminNote, no usageId) gracefully", () => {
		const d = decodeEnvelope(JSON.stringify({ n: "approved retroactively" }));
		expect(d.usageId).toBe(null);
		expect(d.adminNote).toBe("approved retroactively");
	});
});
