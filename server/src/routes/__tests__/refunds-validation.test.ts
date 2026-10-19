/**
 * Zod schema validation for the /v1/refunds + /v1/admin/refunds routes.
 *
 * Pure-logic tests; no DB. Covers the validation surface that the route
 * handlers rely on before they hit Neon:
 *   - createSchema on POST /v1/refunds
 *       - usageId: UUID
 *       - reason:  10–1000 chars
 *       - amountCents: optional positive integer
 *   - decisionSchema on POST /v1/admin/refunds
 *       - id: UUID
 *       - decision: "granted" | "denied"
 *       - adminNote: optional ≤1000 chars
 *
 * The schema objects themselves are not exported from the route file, so
 * these tests re-declare them with the same constraints and assert
 * behavior parity. If a constraint changes, the schema below must be
 * updated to match. (Practical alternative: extract schemas to a shared
 * file — flagged in the route file header.)
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

// Mirror of server/src/routes/refunds.ts createSchema
const createSchema = z.object({
	usageId: z.string().uuid({ message: "usageId must be a usage_records.id (UUID)" }),
	reason: z
		.string()
		.min(10, { message: "reason must be at least 10 characters" })
		.max(1000, { message: "reason must be at most 1000 characters" }),
	amountCents: z
		.number()
		.int()
		.positive()
		.optional(),
});

// Mirror of server/src/routes/admin-refunds.ts decisionSchema
const decisionSchema = z.object({
	id: z.string().uuid(),
	decision: z.enum(["granted", "denied"]),
	adminNote: z.string().max(1000).optional(),
});

describe("POST /v1/refunds — createSchema", () => {
	it("accepts a valid usageId (UUID), reason (10–1000), optional amountCents", () => {
		const r = createSchema.safeParse({
			usageId: "11111111-1111-4111-8111-111111111111",
			reason: "I forgot I had a subscription",
			amountCents: 1,
		});
		expect(r.success).toBe(true);
	});

	it("accepts a missing amountCents (treated as 'full unrefunded portion')", () => {
		const r = createSchema.safeParse({
			usageId: "11111111-1111-4111-8111-111111111111",
			reason: "outage during this request",
		});
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.amountCents).toBeUndefined();
		}
	});

	it("rejects a non-UUID usageId", () => {
		const r = createSchema.safeParse({
			usageId: "not-a-uuid",
			reason: "looks long enough to satisfy the reason minimum",
		});
		expect(r.success).toBe(false);
	});

	it("rejects a reason shorter than 10 characters", () => {
		const r = createSchema.safeParse({
			usageId: "11111111-1111-4111-8111-111111111111",
			reason: "too short",
		});
		expect(r.success).toBe(false);
	});

	it("rejects a reason longer than 1000 characters", () => {
		const r = createSchema.safeParse({
			usageId: "11111111-1111-4111-8111-111111111111",
			reason: "x".repeat(1001),
		});
		expect(r.success).toBe(false);
	});

	it("rejects a non-positive amountCents", () => {
		for (const bad of [0, -1, -100, 1.5, NaN]) {
			const r = createSchema.safeParse({
				usageId: "11111111-1111-4111-8111-111111111111",
				reason: "reasonable refund request reason",
				amountCents: bad,
			});
			expect(r.success, `amountCents=${bad}`).toBe(false);
		}
	});

	it("rejects a missing required field (usageId or reason)", () => {
		expect(
			createSchema.safeParse({ reason: "long enough" }).success,
		).toBe(false);
		expect(
			createSchema.safeParse({ usageId: "11111111-1111-4111-8111-111111111111" })
				.success,
		).toBe(false);
	});
});

describe("POST /v1/admin/refunds — decisionSchema", () => {
	it("accepts a granted decision with an optional admin note", () => {
		const r = decisionSchema.safeParse({
			id: "11111111-1111-4111-8111-111111111111",
			decision: "granted",
			adminNote: "Confirmed outage during the request; full refund approved.",
		});
		expect(r.success).toBe(true);
	});

	it("accepts a denied decision without an admin note", () => {
		const r = decisionSchema.safeParse({
			id: "11111111-1111-4111-8111-111111111111",
			decision: "denied",
		});
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.adminNote).toBeUndefined();
		}
	});

	it("rejects a decision value that is not 'granted' or 'denied'", () => {
		for (const bad of ["approved", "issued", "GRANTED", "", "refunded"]) {
			const r = decisionSchema.safeParse({
				id: "11111111-1111-4111-8111-111111111111",
				decision: bad,
			});
			expect(r.success, `decision=${bad}`).toBe(false);
		}
	});

	it("rejects a non-UUID id", () => {
		const r = decisionSchema.safeParse({
			id: "11111111",
			decision: "granted",
		});
		expect(r.success).toBe(false);
	});

	it("rejects an adminNote over 1000 chars (let the handler log it without storing garbage)", () => {
		const r = decisionSchema.safeParse({
			id: "11111111-1111-4111-8111-111111111111",
			decision: "denied",
			adminNote: "x".repeat(1001),
		});
		expect(r.success).toBe(false);
	});
});
