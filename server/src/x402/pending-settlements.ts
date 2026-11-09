/**
 * Durable record for a settlement that was broadcast but never confirmed
 * within the receipt window.
 *
 * The x402 spec models this as a non-terminal `settlement_pending`: the
 * transfer is already on chain, so retrying is dangerous (the nonce is spent;
 * re-submitting cannot be assumed safe) and ignoring it is worse -- the
 * transfer can confirm later with no credit issued and no record to reconcile
 * from. Previously the only carrier of the broadcast hash was the error
 * message returned to the client; a client that dropped it left an unknown
 * transaction nobody could reconcile.
 *
 * Semantics:
 *
 * - `recordPendingSettlement` is idempotent on (txHash, networkId) and never
 *   throws: the caller is already on an error path that must surface the
 *   original failure.
 * - `reconcilePendingSettlements` asks the chain for each pending row's
 *   receipt and resolves it to `confirmed` or `reverted`. It does NOT credit
 *   anyone: a confirmed row is the evidence for a deliberate credit decision,
 *   not an automatic one (the payment's reservation, if any, already went to
 *   reconciliation through its own path).
 * - Nothing deletes rows: a resolved row is the audit trail of what happened
 *   to the money.
 */

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { pendingSettlements } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import { databaseErrorMetadata } from "../lib/database-error.js";
import { getPublicClient } from "../lib/rpc-client.js";
import { isSuccessfulReceipt } from "./receipt-status.js";

/** The states a broadcast-but-unconfirmed settlement can be in. */
export const PENDING_SETTLEMENT_STATE = {
	/** Broadcast, receipt not yet seen. */
	Pending: "pending",
	/** The chain confirmed the transfer; the payment happened. */
	Confirmed: "confirmed",
	/** The transaction mined but reverted; the funds did not move. */
	Reverted: "reverted",
} as const;

export type PendingSettlementState =
	(typeof PENDING_SETTLEMENT_STATE)[keyof typeof PENDING_SETTLEMENT_STATE];

/**
 * Parse a stored status.
 *
 * `null` for anything unknown: an unfamiliar status must read as unknown, not
 * as pending (which would re-enqueue work) or confirmed (which would
 * reassure).
 */
export function parsePendingSettlementState(
	raw: string | null | undefined,
): PendingSettlementState | null {
	if (raw === PENDING_SETTLEMENT_STATE.Pending) return PENDING_SETTLEMENT_STATE.Pending;
	if (raw === PENDING_SETTLEMENT_STATE.Confirmed) return PENDING_SETTLEMENT_STATE.Confirmed;
	if (raw === PENDING_SETTLEMENT_STATE.Reverted) return PENDING_SETTLEMENT_STATE.Reverted;
	return null;
}

export interface PendingSettlementRecord {
	txHash: string;
	networkId: string;
	amount: string;
	payee: string;
	payer: string;
}

/**
 * Persist a broadcast hash that never confirmed. Idempotent and never
 * throwing; returns whether a row now exists.
 */
export async function recordPendingSettlement(
	record: PendingSettlementRecord,
	lastError: unknown,
): Promise<boolean> {
	try {
		await db
			.insert(pendingSettlements)
			.values({
				txHash: record.txHash,
				networkId: record.networkId,
				amount: record.amount,
				payee: record.payee,
				payer: record.payer,
				status: PENDING_SETTLEMENT_STATE.Pending,
				lastError: lastError instanceof Error ? lastError.message : String(lastError),
			})
			// The broadcast happened once; re-recording it (a second timeout on
			// the same hash) must not duplicate the row.
			.onConflictDoNothing();
		return true;
	} catch (err) {
		logger.error(
			{ err: databaseErrorMetadata(err), txHash: record.txHash, networkId: record.networkId },
			"[PENDING-SETTLEMENT] CRITICAL: could not record unconfirmed broadcast -- manual reconciliation required",
		);
		return false;
	}
}

interface ReconcileResult {
	scanned: number;
	confirmed: number;
	reverted: number;
	stillPending: number;
	failed: number;
}

/**
 * Ask the chain about every pending broadcast. Resolves rows in place; never
 * throws (the drain runs on a schedule and must survive one bad row).
 */
export async function reconcilePendingSettlements(
	batchSize = 25,
): Promise<ReconcileResult> {
	const result: ReconcileResult = {
		scanned: 0,
		confirmed: 0,
		reverted: 0,
		stillPending: 0,
		failed: 0,
	};

	let due: (typeof pendingSettlements.$inferSelect)[];
	try {
		due = await db
			.select()
			.from(pendingSettlements)
			.where(eq(pendingSettlements.status, PENDING_SETTLEMENT_STATE.Pending))
			.orderBy(asc(pendingSettlements.broadcastAt))
			.limit(batchSize);
	} catch (err) {
		logger.error({ err: databaseErrorMetadata(err) }, "[PENDING-SETTLEMENT] could not read pending rows");
		return result;
	}

	result.scanned = due.length;
	if (due.length === 0) return result;

	const client = (() => {
		try {
			return getPublicClient();
		} catch (err) {
			logger.error({ err: databaseErrorMetadata(err) }, "[PENDING-SETTLEMENT] no chain client; leaving rows pending");
			return null;
		}
	})();
	if (!client) return { ...result, stillPending: result.scanned };

	for (const row of due) {
		try {
			const receipt = await client.getTransactionReceipt({
				hash: row.txHash as `0x${string}`,
			});
			if (!receipt) {
				// Not mined yet -- genuinely still pending.
				result.stillPending++;
				continue;
			}
			if (isSuccessfulReceipt(receipt)) {
				await db
					.update(pendingSettlements)
					.set({
						status: PENDING_SETTLEMENT_STATE.Confirmed,
						receipt: JSON.stringify(receipt),
						resolvedAt: new Date(),
						lastError: null,
					})
					.where(eq(pendingSettlements.id, row.id));
				result.confirmed++;
				logger.warn(
					{ txHash: row.txHash, networkId: row.networkId, amount: row.amount },
					"[PENDING-SETTLEMENT] broadcast CONFIRMED on chain -- credit decision required",
				);
			} else {
				await db
					.update(pendingSettlements)
					.set({
						status: PENDING_SETTLEMENT_STATE.Reverted,
						receipt: JSON.stringify(receipt),
						resolvedAt: new Date(),
					})
					.where(eq(pendingSettlements.id, row.id));
				result.reverted++;
				logger.info(
					{ txHash: row.txHash, networkId: row.networkId },
					"[PENDING-SETTLEMENT] broadcast reverted on chain; funds did not move",
				);
			}
		} catch (err) {
			result.failed++;
			await db
				.update(pendingSettlements)
				.set({
					lastError: JSON.stringify(databaseErrorMetadata(err)),
				})
				.where(and(eq(pendingSettlements.id, row.id), eq(pendingSettlements.status, PENDING_SETTLEMENT_STATE.Pending)));
			logger.warn(
				{ err: databaseErrorMetadata(err), txHash: row.txHash },
				"[PENDING-SETTLEMENT] reconciliation attempt failed; row stays pending",
			);
		}
	}
	return result;
}

/** Pending depth, for health/ops surfaces. */
export async function countPendingSettlements(): Promise<number> {
	try {
		const [row] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(pendingSettlements)
			.where(eq(pendingSettlements.status, PENDING_SETTLEMENT_STATE.Pending));
		return row?.count ?? 0;
	} catch (err) {
		logger.error({ err: databaseErrorMetadata(err) }, "[PENDING-SETTLEMENT] could not count pending rows");
		return 0;
	}
}

// The receipt predicate is the same fail-closed rule the x402 paths use.
