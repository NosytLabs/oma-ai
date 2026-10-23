/** Usage refunds return prepaid credits; they never send money off-platform. */
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { auditLogs, creditBalances, refundRequests, usageRecords, user } from "../db/schema.js";
import { createRefundSchema, decodeEnvelope, encodeEnvelope, type CreateRefundBody, type DecideRefundBody } from "../routes/_refund-schemas.js";

export class RefundError extends Error {
	constructor(message: string, public readonly status: 400 | 404 | 409 | 429) {
		super(message);
	}
}

const MAX_OPEN_REQUESTS = 5;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function createUsageRefund(userId: string, input: CreateRefundBody) {
	return db.transaction(async tx => {
		// Serialize intake per account, including different usage IDs, so the
		// pending limit cannot be bypassed by concurrent submissions.
		const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
		if (!owner) throw new RefundError("Account not found", 404);
		const [usage] = await tx.select().from(usageRecords)
			.where(and(eq(usageRecords.id, input.usageId), eq(usageRecords.userId, userId))).for("update");
		if (!usage) throw new RefundError("usageId not found", 404);
		if (usage.refundedAt) throw new RefundError("This charge has already been refunded", 409);
		const age = Date.now() - usage.createdAt.getTime();
		if (age < 0 || age > MAX_AGE_MS) throw new RefundError("Refunds must be requested within 30 days of the original charge", 400);
		const cents = Number(usage.totalCents);
		if (!Number.isFinite(cents) || cents <= 0) throw new RefundError("Only a paid usage charge can be refunded", 400);
		// All usage/account reports represent a refund with refundedAt. Until
		// partial allocations exist, accepting a partial amount would erase the
		// entire charge from those reports. Require an exact full-charge refund.
		if (input.amountCents !== undefined && input.amountCents !== cents) {
			throw new RefundError("Only full usage-charge refunds are supported; omit amountCents", 400);
		}
		const pending = await tx.select({ notes: refundRequests.notes }).from(refundRequests)
			.where(and(eq(refundRequests.userId, userId), eq(refundRequests.status, "pending"))).limit(MAX_OPEN_REQUESTS + 1);
		if (pending.some(row => decodeEnvelope(row.notes).usageId === usage.id)) {
			throw new RefundError("A refund request for this charge is already pending", 409);
		}
		if (pending.length >= MAX_OPEN_REQUESTS) throw new RefundError("You already have 5 open refund requests. Wait for a review before opening more.", 429);
		const [row] = await tx.insert(refundRequests).values({
			userId, amountCents: usage.totalCents, reason: input.reason,
			notes: encodeEnvelope({ u: usage.id }), status: "pending",
		}).returning();
		return { id: row.id, usageId: usage.id, amountCents: Number(row.amountCents), status: row.status, createdAt: row.createdAt };
	});
}

export async function decideUsageRefund(adminId: string, input: DecideRefundBody) {
	return db.transaction(async tx => {
		const [row] = await tx.select().from(refundRequests).where(eq(refundRequests.id, input.id)).for("update");
		if (!row) throw new RefundError("Refund request not found", 404);
		if (row.status !== "pending") throw new RefundError(`Already ${row.status}; decisions are terminal`, 409);
		const { usageId } = decodeEnvelope(row.notes);
		if (input.decision === "granted") {
			if (!usageId || !createRefundSchema.shape.usageId.safeParse(usageId).success) throw new RefundError("Refund has no valid usage charge; review it before granting", 409);
			// Lock the usage row as well: old duplicate requests must not each
			// restore the same charge. Compare amounts in Postgres, not floats.
			const [usage] = await tx.select().from(usageRecords).where(and(
				eq(usageRecords.id, usageId), eq(usageRecords.userId, row.userId),
				eq(usageRecords.totalCents, row.amountCents),
			)).for("update");
			if (!usage || usage.refundedAt || Number(usage.totalCents) <= 0) {
				throw new RefundError("Charge is missing, already refunded, or does not match the requested amount. Review this request.", 409);
			}
			const [balance] = await tx.update(creditBalances).set({
				balanceCents: sql`${creditBalances.balanceCents} + ${usage.totalCents}::numeric`,
				totalUsedCents: sql`greatest(${creditBalances.totalUsedCents} - ${usage.totalCents}::numeric, 0)`,
				lastActivityAt: sql`now()`, updatedAt: sql`now()`,
			}).where(eq(creditBalances.userId, row.userId)).returning({ userId: creditBalances.userId });
			if (!balance) throw new RefundError("Account credit ledger is missing; reconcile it before granting", 409);
			await tx.update(usageRecords).set({ refundedAt: sql`now()` }).where(eq(usageRecords.id, usage.id));
			await tx.execute(sql`UPDATE inference_financial_receipts SET refunded_cents=${usage.totalCents}::numeric,updated_at=NOW() WHERE request_id=${usage.requestId}`);
		}
		await tx.update(refundRequests).set({
			status: input.decision, notes: encodeEnvelope({ u: usageId ?? undefined, n: input.adminNote }),
			decidedBy: adminId, decidedAt: sql`now()`,
		}).where(eq(refundRequests.id, row.id));
		// Audit and money changes commit together; a failed decision remains
		// pending with its charge and balance untouched, ready for a retry.
		await tx.insert(auditLogs).values({
			userId: adminId, action: input.decision === "granted" ? "REFUND_GRANTED" : "REFUND_DENIED",
			resource: "usage_refund", resourceId: row.id,
			metadata: { userId: row.userId, usageId, amountCents: row.amountCents },
		});
		return { id: row.id, status: input.decision, usageId, adminNote: input.adminNote ?? null };
	});
}
