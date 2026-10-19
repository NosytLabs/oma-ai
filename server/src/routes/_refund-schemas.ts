/**
 * Shared refund-route Zod schemas + envelope helpers.
 *
 * Extracted from server/src/routes/refunds.ts + admin-refunds.ts so
 * the test suite can import the same schema the routes ship with —
 * the prior refunds-validation.test.ts mirrored the schemas by hand,
 * so a route constraint change could pass tests while breaking prod.
 *
 * If you change a constraint here, BOTH the route and the test
 * pick it up automatically. No drift.
 */
import { z } from "zod";

/** POST /v1/refunds body. */
export const createRefundSchema = z.object({
	usageId: z.string().uuid({ message: "usageId must be a usage_records.id (UUID)" }),
	reason: z
		.string()
		.min(10, { message: "reason must be at least 10 characters" })
		.max(1000, { message: "reason must be at most 1000 characters" }),
	amountCents: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Optional partial-refund amount; defaults to the full unrefunded portion"),
});

/** GET /v1/refunds query. */
export const listRefundsSchema = z.object({
	status: z.enum(["pending", "granted", "denied"]).optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** GET /v1/admin/refunds query. */
export const listAdminRefundsSchema = z.object({
	status: z.enum(["pending", "granted", "denied"]).optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** POST /v1/admin/refunds body. */
export const decideRefundSchema = z.object({
	id: z.string().uuid(),
	decision: z.enum(["granted", "denied"]),
	adminNote: z.string().max(1000).optional(),
});

export type CreateRefundBody = z.infer<typeof createRefundSchema>;
export type ListRefundsQuery = z.infer<typeof listRefundsSchema>;
export type ListAdminRefundsQuery = z.infer<typeof listAdminRefundsSchema>;
export type DecideRefundBody = z.infer<typeof decideRefundSchema>;

/**
 * The `refund_requests.notes` column is reused as a tiny JSON envelope
 * so the schema doesn't need a migration. Stable key order keeps
 * equal envelopes producing equal strings (hashable, dedupable).
 */
export type Envelope = { u?: string; n?: string };

export function encodeEnvelope(env: Envelope): string {
	return JSON.stringify({ u: env.u, n: env.n });
}

export function decodeEnvelope(notes: string | null): {
	usageId: string | null;
	adminNote: string | null;
} {
	if (!notes) return { usageId: null, adminNote: null };
	try {
		const obj = JSON.parse(notes) as Envelope;
		return { usageId: obj.u ?? null, adminNote: obj.n ?? null };
	} catch {
		// Backwards-compat: legacy rows stored the raw usageId in `notes`.
		return { usageId: notes, adminNote: null };
	}
}
