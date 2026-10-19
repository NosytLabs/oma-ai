/**
 * GET  /v1/admin/refunds   — list all refund_requests (filtered by status)
 * POST /v1/admin/refunds   — grant or deny a request; on grant, marks
 *                            usage_records.refundedAt so future balance /
 *                            usage queries exclude the cents.
 *
 * Shares the `notes`-envelope convention with routes/refunds.ts.
 * Requires session/bearer auth + requireAdmin(). Admin decisions are
 * terminal — the row's status never moves out of {granted, denied}.
 */
import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import type { OmaEnv } from "../types.js";
import { sessionOrBearerAuth, requireAdmin } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { refundRequests, usageRecords } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import { decodeEnvelope, listAdminRefundsSchema, decideRefundSchema } from "./_refund-schemas.js";

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
		const { id, decision, adminNote } = parsed.data;

		const [row] = await db
			.select()
			.from(refundRequests)
			.where(eq(refundRequests.id, id))
			.limit(1);
		if (!row) {
			return c.json({ error: { message: "Refund request not found" } }, 404);
		}
		if (row.status !== "pending") {
			return c.json(
				{ error: { message: `Already ${row.status}; decisions are terminal` } },
				409,
			);
		}

		const { usageId } = decodeEnvelope(row.notes);
		const newStatus: "granted" | "denied" = decision;

		// On grant: actually mark the underlying usage row so future
		// usage/balance queries exclude the cents. Guard with a
		// not-already-refunded predicate so a double-approval is a no-op.
				if (newStatus === "granted" && usageId) {
			try {
				await db
					.update(usageRecords)
					.set({ refundedAt: sql`now()` })
					.where(
						and(
							eq(usageRecords.id, usageId),
							sql`${usageRecords.refundedAt} IS NULL`,
						),
					);
			} catch (err) {
				logger.error(
					{ err, refundId: id, usageId },
					"[admin/refunds] usage mark failed",
				);
				return c.json(
					{ error: { message: "Could not mark usage as refunded; refund decision NOT saved" } },
					500,
				);
			}
		}

				// Preserve the existing usageId in the envelope, add the admin note.
		const nextNotes = JSON.stringify({
			u: usageId ?? null,
			n: adminNote ?? null,
		});

		try {
			await db
				.update(refundRequests)
				.set({
					status: newStatus,
					notes: nextNotes,
					decidedBy: adminId,
					decidedAt: sql`now()`,
				})
				.where(eq(refundRequests.id, id));
		} catch (err) {
			logger.error({ err, refundId: id }, "[admin/refunds] decision save failed");
			return c.json({ error: { message: "Could not save decision" } }, 500);
		}

		return c.json({ id, status: newStatus, usageId, adminNote: adminNote ?? null });
	},
);
