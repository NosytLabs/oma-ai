/**
 * GET  /v1/refunds        — list the caller's own refund_requests
 * POST /v1/refunds        — create a new refund_request against a usage charge
 *
 * The user-facing side of the refund flow. Writes a row in
 * `refund_requests` with status='pending' for an admin to review via
 * POST /v1/admin/refunds. The actual `usage_records.refundedAt` mark is
 * only set when the admin grants the refund; this endpoint never touches
 * credits directly.
 *
 * The `notes` column on refund_requests holds a small JSON envelope:
 *   { "u": "<usageId>", "n": "<adminNote>" }
 * to keep the existing schema unchanged. usageId is set on create;
 * adminNote is appended on admin decision.
 *
 * Validation: usage must belong to the caller, be within the last 30
 * days, and not already be refunded. Caller may have at most 5 open
 * (pending) refund requests at a time.
 *
 * Requires session or bearer auth.
 */
import { Hono } from "hono";
import { z } from "zod";
import { and, count, desc, eq } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { refundRequests, usageRecords } from "../db/schema.js";
import { logger } from "../lib/logger.js";

export const refundsRoutes = new Hono<OmaEnv>();

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
		.optional()
		.describe("Optional partial-refund amount; defaults to the full unrefunded portion"),
});

const listSchema = z.object({
	status: z.enum(["pending", "granted", "denied"]).optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
});

const MAX_OPEN_REQUESTS = 5;
const MAX_AGE_DAYS = 30;

type Envelope = { u?: string; n?: string };

function encodeEnvelope(env: Envelope): string {
	// Stable key order so equal envelopes produce equal notes strings.
	return JSON.stringify({ u: env.u, n: env.n });
}
function decodeEnvelope(notes: string | null): { usageId: string | null; adminNote: string | null } {
	if (!notes) return { usageId: null, adminNote: null };
	try {
		const obj = JSON.parse(notes) as Envelope;
		return { usageId: obj.u ?? null, adminNote: obj.n ?? null };
	} catch {
		// Backwards-compat: legacy rows stored the raw usageId in `notes`.
		return { usageId: notes, adminNote: null };
	}
}

// ─── GET /v1/refunds ────────────────────────────────────────────────────────

refundsRoutes.get("/v1/refunds", sessionOrBearerAuth, async (c) => {
	c.header("Cache-Control", "no-store");
	const userId = c.get("userId");
	const parsed = listSchema.safeParse({
		status: c.req.query("status"),
		limit: c.req.query("limit") ?? undefined,
	});
	if (!parsed.success) {
		return c.json(
			{ error: { message: "Invalid query parameters", issues: parsed.error.flatten() } },
			400,
		);
	}
	const { status, limit } = parsed.data;

	const rows = await db
		.select({
			id: refundRequests.id,
			amountCents: refundRequests.amountCents,
			status: refundRequests.status,
			reason: refundRequests.reason,
			notes: refundRequests.notes,
			decidedBy: refundRequests.decidedBy,
			decidedAt: refundRequests.decidedAt,
			createdAt: refundRequests.createdAt,
		})
		.from(refundRequests)
		.where(
			and(
				eq(refundRequests.userId, userId),
				status ? eq(refundRequests.status, status) : undefined,
			),
		)
		.orderBy(desc(refundRequests.createdAt))
		.limit(limit);

	const data = rows.map((r) => {
		const { usageId, adminNote } = decodeEnvelope(r.notes);
		return {
			id: r.id,
			usageId,
			amountCents: Number(r.amountCents),
			status: r.status,
			reason: r.reason,
			adminNote,
			decidedBy: r.decidedBy,
			decidedAt: r.decidedAt,
			createdAt: r.createdAt,
		};
	});

	return c.json({ data });
});

// ─── POST /v1/refunds ───────────────────────────────────────────────────────

refundsRoutes.post("/v1/refunds", sessionOrBearerAuth, async (c) => {
	c.header("Cache-Control", "no-store");
	const userId = c.get("userId");

	const body = await c.req.json().catch(() => null);
	const parsed = createSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{ error: { message: "Invalid request", issues: parsed.error.flatten() } },
			400,
		);
	}
	const { usageId, reason, amountCents } = parsed.data;

	// 1. usage must exist, belong to the caller, be in-range, and not
	//    already be refunded.
	const [usage] = await db
		.select({
			id: usageRecords.id,
			userId: usageRecords.userId,
			totalCents: usageRecords.totalCents,
			refundedAt: usageRecords.refundedAt,
			createdAt: usageRecords.createdAt,
		})
		.from(usageRecords)
		.where(eq(usageRecords.id, usageId))
		.limit(1);

	if (!usage) {
		return c.json({ error: { message: "usageId not found" } }, 404);
	}
	if (usage.userId !== userId) {
		// Don't leak existence — return 404 for both "not found" and "not yours".
		return c.json({ error: { message: "usageId not found" } }, 404);
	}
	if (usage.refundedAt) {
		return c.json(
			{ error: { message: "usageId has already been refunded" } },
			400,
		);
	}
	const ageDays = (Date.now() - usage.createdAt.getTime()) / (1000 * 60 * 60 * 24);
	if (ageDays > MAX_AGE_DAYS) {
		return c.json(
			{
				error: {
					message: `Refunds must be requested within ${MAX_AGE_DAYS} days of the original charge (charge is ${ageDays.toFixed(0)} days old)`,
				},
			},
			400,
		);
	}

	// 2. Cap open requests per user — 5 is the threshold from the docs.
	const [{ open } = { open: 0 }] = await db
		.select({ open: count() })
		.from(refundRequests)
		.where(
			and(
				eq(refundRequests.userId, userId),
				eq(refundRequests.status, "pending"),
			),
		);
	if (Number(open) >= MAX_OPEN_REQUESTS) {
		return c.json(
			{
				error: {
					message: `You already have ${open} open refund requests (max ${MAX_OPEN_REQUESTS}). Wait for an admin to review them before opening more.`,
				},
			},
			429,
		);
	}

	// 3. Default amount = full unrefunded portion (i.e. totalCents), but
	//    never more than the original charge.
	const fullCents = Number(usage.totalCents);
	const requestedCents = amountCents ?? fullCents;
	if (requestedCents > fullCents) {
		return c.json(
			{
				error: {
					message: `amountCents (${requestedCents}) cannot exceed the original charge (${fullCents})`,
				},
			},
			400,
		);
	}

	// 4. Insert. usageId is stashed in the `notes` envelope; the admin
	//    route reads it back to mark the underlying usage row.
	try {
		const [row] = await db
			.insert(refundRequests)
			.values({
				userId,
				amountCents: String(requestedCents),
				reason,
				notes: encodeEnvelope({ u: usageId }),
				status: "pending",
			})
			.returning();
		return c.json(
			{
				id: row.id,
				usageId,
				amountCents: requestedCents,
				status: row.status,
				createdAt: row.createdAt,
			},
			200,
		);
	} catch (err) {
		logger.error({ err, userId, usageId }, "[refunds] create failed");
		return c.json({ error: { message: "Could not create refund request" } }, 500);
	}
});

// Re-export helpers for the admin route to share (read-only).
export { encodeEnvelope, decodeEnvelope };
