/** Durable per-order card credit accounting. These synthetic event rows are
 * financial records: retain them when cleaning webhook delivery history. */
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { creditBalances, polarWebhookEvents } from "../db/schema.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const integerAmount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const snapshotSchema = z.object({
	id: z.string().trim().min(1).max(200),
	paid: z.literal(true),
	product_id: z.string().min(1).optional(),
	product: z.object({ id: z.string().min(1) }).nullish(),
	metadata: z.object({ userId: z.string().min(1) }),
	net_amount: integerAmount.positive(),
	refunded_amount: integerAmount,
	// Applied Polar customer balances can mix unrelated invoice debt/credit
	// into the refund. Require operator reconciliation for that allocation.
	applied_balance_amount: z.literal(0),
	currency: z.string().regex(/^[a-z]{3}$/),
});
const ledgerSchema = z.object({
	version: z.literal(1), orderId: z.string(), userId: z.string(), productId: z.string(),
	currency: z.string(), netAmount: integerAmount.positive(),
	creditCents: integerAmount.positive(), refundedAmount: integerAmount,
});
const SCALE = 100_000_000n;
const cents = (units: bigint) => `${units / SCALE}.${(units % SCALE).toString().padStart(8, "0")}`;

/** Polar's order.refunded contains cumulative refunded_amount (net, excluding
 * refunded_tax_amount), not this delivery's refund. Grant once per order and
 * reverse only the increase, irrespective of delivery IDs or arrival order.
 * Caller claims the delivery in the same transaction. */
export async function reconcilePolarOrderCredit(
	tx: Transaction, eventId: string, input: unknown, creditCents: number,
): Promise<number> {
	const snapshot = snapshotSchema.parse(input);
	const productId = snapshot.product_id ?? snapshot.product?.id;
	if (!productId || (snapshot.product?.id && snapshot.product.id !== productId)) {
		throw new Error("Polar order identity requires reconciliation");
	}
	const incoming = ledgerSchema.parse({
		version: 1, orderId: snapshot.id, userId: snapshot.metadata.userId, productId,
		currency: snapshot.currency, netAmount: snapshot.net_amount, creditCents, refundedAmount: 0,
	});
	const key = `order-credit:${snapshot.id}`;
	const inserted = await tx.insert(polarWebhookEvents).values({
		polarEventId: key, eventType: "order.credit-ledger.v1", payload: JSON.stringify(incoming), processed: 1,
	}).onConflictDoNothing().returning({ id: polarWebhookEvents.id });
	const [record] = await tx.select().from(polarWebhookEvents).where(eq(polarWebhookEvents.polarEventId, key)).for("update");
	if (!record || record.eventType !== "order.credit-ledger.v1") throw new Error("Polar order ledger is missing or conflicting");
	const previous = ledgerSchema.parse(JSON.parse(record.payload));
	if (previous.orderId !== incoming.orderId || previous.userId !== incoming.userId || previous.productId !== incoming.productId ||
		previous.currency !== incoming.currency || previous.netAmount !== incoming.netAmount || previous.creditCents !== incoming.creditCents ||
		previous.refundedAmount > previous.netAmount) {
		throw new Error("Polar order changed its original credit identity; reconcile before retrying");
	}
	if (inserted.length) {
		// Existing installations may have credited this order before this ledger
		// existed. Never guess an opening balance or grant a second time.
		const historical = await tx.execute(sql`SELECT id FROM polar_webhook_events
			WHERE event_type IN ('order.paid','order.refunded') AND processed=1
			AND polar_event_id<>${eventId} AND payload::jsonb #>> '{data,id}'=${snapshot.id} LIMIT 1`);
		if (historical.rows.length) throw new Error("Legacy Polar order requires an opening-ledger reconciliation");
		await tx.insert(creditBalances).values({
			userId: incoming.userId, balanceCents: String(creditCents), totalDepositedCents: String(creditCents), totalUsedCents: "0",
		}).onConflictDoUpdate({ target: creditBalances.userId, set: {
			balanceCents: sql`${creditBalances.balanceCents} + ${creditCents}::numeric`,
			totalDepositedCents: sql`${creditBalances.totalDepositedCents} + ${creditCents}::numeric`,
			lastActivityAt: sql`now()`, updatedAt: sql`now()`,
		} });
	}
	// Polar's stacked tax rounding can report net refunds above the original
	// net amount. Keep the signed raw delivery, but reverse at most this order's
	// grant. Stale or repeated oversized totals cannot undo or exceed that cap.
	const netAmount = BigInt(previous.netAmount);
	const providerRefundedAmount = BigInt(snapshot.refunded_amount);
	const boundedRefundedAmount = providerRefundedAmount > netAmount ? netAmount : providerRefundedAmount;
	const refundedAmount = Math.max(previous.refundedAmount, Number(boundedRefundedAmount));
	const grantUnits = BigInt(previous.creditCents) * SCALE;
	// Cumulative integer division rounds down by at most one ledger unit and
	// telescopes exactly to the full grant when the order is fully refunded.
	const reversedUnits = grantUnits * BigInt(refundedAmount) / netAmount;
	const oldReversedUnits = grantUnits * BigInt(previous.refundedAmount) / netAmount;
	const delta = cents(reversedUnits - oldReversedUnits);
	if (reversedUnits > oldReversedUnits) {
		const updated = await tx.update(creditBalances).set({
			// A refund can exceed spendable credit because credit is used or held.
			// Retain the debt: subsequent hold returns/funding must repay it.
			balanceCents: sql`${creditBalances.balanceCents} - ${delta}::numeric`,
			totalDepositedCents: sql`${creditBalances.totalDepositedCents} - ${delta}::numeric`,
			lastActivityAt: sql`now()`, updatedAt: sql`now()`,
		}).where(eq(creditBalances.userId, incoming.userId)).returning({ userId: creditBalances.userId });
		if (!updated.length) throw new Error("Polar refund account ledger is missing; reconcile before retrying");
	}
	await tx.update(polarWebhookEvents).set({ payload: JSON.stringify({ ...previous, refundedAmount }) }).where(eq(polarWebhookEvents.id, record.id));
	// Telemetry reports the actual credit movement, not the configured pack
	// value again on every partial refund, stale snapshot or duplicate order.
	return Number((inserted.length ? grantUnits : 0n) - (reversedUnits - oldReversedUnits)) / Number(SCALE);
}
