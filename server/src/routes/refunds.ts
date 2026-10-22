/** Customer usage-credit refund intake and account-scoped history. */
import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { refundRequests } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import { originGuard } from "../middleware/origin-guard.js";
import {
	createRefundSchema,
	decodeEnvelope,
	listRefundsSchema,
} from "./_refund-schemas.js";

import { createUsageRefund, RefundError } from "../lib/usage-refunds.js";

export const refundsRoutes = new Hono<OmaEnv>();


// ─── GET /v1/refunds ────────────────────────────────────────────────────────

refundsRoutes.get("/v1/refunds", sessionOrBearerAuth, async (c) => {
	c.header("Cache-Control", "no-store");
	const userId = c.get("userId");
	const parsed = listRefundsSchema.safeParse({
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

	return c.json({ data, creditRefundsAvailable: true });
});

// ─── POST /v1/refunds ───────────────────────────────────────────────────────

const enforceOrigin = originGuard();
refundsRoutes.post("/v1/refunds", sessionOrBearerAuth, async (c, next) => {
	// Check the credential actually selected by authentication. SDK callers
	// with an API key need no browser Origin; cookie-authenticated writes do.
	return c.get("session") ? enforceOrigin(c, next) : next();
}, async (c) => {
	c.header("Cache-Control", "no-store");
	const userId = c.get("userId");

	const body = await c.req.json().catch(() => null);
	const parsed = createRefundSchema.safeParse(body);
	if (!parsed.success) {
		return c.json(
			{ error: { message: "Invalid request", issues: parsed.error.flatten() } },
			400,
		);
	}
	const { usageId, reason, amountCents } = parsed.data;

	try {
		return c.json(await createUsageRefund(userId, { usageId, reason, amountCents }));
	} catch (err) {
		if (err instanceof RefundError) return c.json({ error: { message: err.message } }, err.status);
		logger.error({ err, userId, usageId }, "[refunds] create failed");
		return c.json({ error: { message: "Could not create refund request" } }, 500);
	}
});

// Re-export helpers for the admin route to share (read-only).
export { encodeEnvelope, decodeEnvelope } from "./_refund-schemas.js";
