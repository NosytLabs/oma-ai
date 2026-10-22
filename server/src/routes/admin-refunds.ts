/** Operator refund history and atomic usage-credit decisions. */
import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth, requireAdmin } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { refundRequests } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import { decodeEnvelope, listAdminRefundsSchema, decideRefundSchema } from "./_refund-schemas.js";

import { decideUsageRefund, RefundError } from "../lib/usage-refunds.js";

export const adminRefundsRoutes = new Hono<OmaEnv>();

adminRefundsRoutes.get(
	"/v1/admin/refunds",
	sessionOrBearerAuth,
	requireAdmin(),
	async (c) => {
		c.header("Cache-Control", "no-store");
		const parsed = listAdminRefundsSchema.safeParse({
			status: c.req.query("status") ?? undefined,
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
				userId: refundRequests.userId,
				amountCents: refundRequests.amountCents,
				status: refundRequests.status,
				reason: refundRequests.reason,
				notes: refundRequests.notes,
				decidedBy: refundRequests.decidedBy,
				decidedAt: refundRequests.decidedAt,
				createdAt: refundRequests.createdAt,
			})
			.from(refundRequests)
			.where(status ? eq(refundRequests.status, status) : undefined)
			.orderBy(sql`${refundRequests.createdAt} DESC`)
			.limit(limit);

		return c.json({
			data: rows.map((r) => {
				const { usageId, adminNote } = decodeEnvelope(r.notes);
				return {
					id: r.id,
					userId: r.userId,
					usageId,
					amountCents: Number(r.amountCents),
					status: r.status,
					reason: r.reason,
					adminNote,
					decidedBy: r.decidedBy,
					decidedAt: r.decidedAt,
					createdAt: r.createdAt,
				};
			}),
		});
	},
);

adminRefundsRoutes.post(
	"/v1/admin/refunds",
	sessionOrBearerAuth,
	requireAdmin(),
	async (c) => {
		c.header("Cache-Control", "no-store");
		const adminId = c.get("userId");
		const body = await c.req.json().catch(() => null);
		const parsed = decideRefundSchema.safeParse(body);
		if (!parsed.success) {
			return c.json(
				{ error: { message: "Invalid request", issues: parsed.error.flatten() } },
				400,
			);
		}
		try {
			return c.json(await decideUsageRefund(adminId, parsed.data));
		} catch (err) {
			if (err instanceof RefundError) return c.json({ error: { message: err.message } }, err.status);
			logger.error({ err, refundId: parsed.data.id }, "[admin/refunds] decision failed");
			return c.json({ error: { message: "Could not save decision; no credits were changed" } }, 500);
		}
	},
);
