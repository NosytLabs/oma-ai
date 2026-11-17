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
 * - `reconcilePendingSettlements` asks the chain for each in-flight row's
 *   receipt and resolves it to `confirmed` or `reverted`. It scans `verified`
 *   rows as well as `pending` ones: a crash between `recordVerifiedSettlement`
 *   and `markSettlementDurable` used to leave a verified payment invisible --
 *   never reconciled, never counted. A verified row whose settlement is
 *   already durable in `settlements` is closed as `settled`; one with a chain
 *   receipt resolves like a pending row; one with neither stays `verified`
 *   and is counted, so the gap is visible instead of silent. The reconciler
 *   does NOT credit anyone: a confirmed row is the evidence for a deliberate
 *   credit decision, not an automatic one (the payment's reservation, if
 *   any, already went to reconciliation through its own path).
 * - Nothing deletes rows: a resolved row is the audit trail of what happened
 *   to the money.
 */

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { pendingSettlements, settlements } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import { databaseErrorMetadata } from "../lib/database-error.js";
import { getPublicClient } from "../lib/rpc-client.js";
import { isSuccessfulReceipt } from "./receipt-status.js";

/**
 * The states of an in-flight settlement.
 *
 * The table started as the record of a broadcast whose receipt never arrived;
 * it now carries every settlement that is not yet durable, so the
 * Verified-but-unsettled window (previously held only in an in-memory cache
 * that restarts and LRU eviction could drop) survives a restart too.
 */
export const PENDING_SETTLEMENT_STATE = {
	/** Payment verified, settlement submitted, receipt not yet seen. */
	Pending: "pending",
	/** Payment verified but settlement not yet submitted. */
	Verified: "verified",
	/** The chain confirmed the transfer; the payment happened. */
	Confirmed: "confirmed",
	/** The transaction mined but reverted; the funds did not move. */
	Reverted: "reverted",
	/** The settlement is durable in the `settlements` table. */
	Settled: "settled",
} as const;

type PendingSettlementState =
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
	if (raw === PENDING_SETTLEMENT_STATE.Verified) return PENDING_SETTLEMENT_STATE.Verified;
	if (raw === PENDING_SETTLEMENT_STATE.Confirmed) return PENDING_SETTLEMENT_STATE.Confirmed;
	if (raw === PENDING_SETTLEMENT_STATE.Reverted) return PENDING_SETTLEMENT_STATE.Reverted;
	if (raw === PENDING_SETTLEMENT_STATE.Settled) return PENDING_SETTLEMENT_STATE.Settled;
	return null;
}

/**
 * Legal transitions.
 *
 * `verified` and `pending` are the two in-flight states; both resolve the
 * same way -- to `settled` when the durable ledger row exists, or to the
 * chain facts `confirmed` / `reverted` when a receipt answers. `confirmed`
 * is an audit end-state (the credit decision is a separate, deliberate
 * step), as are `reverted` and `settled`. Until this table existed the
 * machine had no named transitions at all, and the reconciler's scan covered
 * only half of the in-flight states.
 */
export const PENDING_SETTLEMENT_TRANSITIONS: Record<
	PendingSettlementState,
	readonly PendingSettlementState[]
> = {
	[PENDING_SETTLEMENT_STATE.Verified]: [
		PENDING_SETTLEMENT_STATE.Settled,
		PENDING_SETTLEMENT_STATE.Confirmed,
		PENDING_SETTLEMENT_STATE.Reverted,
	],
	[PENDING_SETTLEMENT_STATE.Pending]: [
		PENDING_SETTLEMENT_STATE.Settled,
		PENDING_SETTLEMENT_STATE.Confirmed,
		PENDING_SETTLEMENT_STATE.Reverted,
	],
	[PENDING_SETTLEMENT_STATE.Confirmed]: [],
	[PENDING_SETTLEMENT_STATE.Reverted]: [],
	[PENDING_SETTLEMENT_STATE.Settled]: [],
};

/** True when `next` is a legal successor of `current`. */
export function canTransitionPendingSettlementState(
	current: PendingSettlementState,
	next: PendingSettlementState,
): boolean {
	return PENDING_SETTLEMENT_TRANSITIONS[current].includes(next);
}

/** States the reconciler is responsible for: everything still in flight. */
const IN_FLIGHT_SETTLEMENT_STATES: readonly PendingSettlementState[] = [
	PENDING_SETTLEMENT_STATE.Verified,
	PENDING_SETTLEMENT_STATE.Pending,
];

interface PendingSettlementRecord {
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

/**
 * Record a VERIFIED payment whose settlement is about to be submitted.
 *
 * This closes the restart window: between verification and a durable
 * settlements row, the only record of the payment used to be an in-memory
 * cache entry. The row is idempotent on (txHash, networkId) and never throws.
 */
export async function recordVerifiedSettlement(
	record: PendingSettlementRecord,
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
				status: PENDING_SETTLEMENT_STATE.Verified,
			})
			// The same payment re-verified (retry, restart, second route hit)
			// must not duplicate the row.
			.onConflictDoNothing();
		return true;
	} catch (err) {
		logger.error(
			{ err: databaseErrorMetadata(err), txHash: record.txHash },
			"[PENDING-SETTLEMENT] could not record verified payment",
		);
		return false;
	}
}

/**
 * Mark an in-flight settlement as durably present in `settlements`. Called
 * from the settle path; never throws.
 */
export async function markSettlementDurable(txHash: string, networkId: string): Promise<void> {
	try {
		await db
			.update(pendingSettlements)
			.set({
				status: PENDING_SETTLEMENT_STATE.Settled,
				resolvedAt: new Date(),
				lastError: null,
			})
			.where(
				and(
					eq(pendingSettlements.txHash, txHash),
					eq(pendingSettlements.networkId, networkId),
					// Never overwrite a chain-resolved state: confirmed/reverted
					// are facts about the money; settled is a fact about our ledger.
					sql`${pendingSettlements.status} IN (${PENDING_SETTLEMENT_STATE.Verified}, ${PENDING_SETTLEMENT_STATE.Pending})`,
				),
			);
	} catch (err) {
		logger.warn(
			{ err: databaseErrorMetadata(err), txHash },
			"[PENDING-SETTLEMENT] could not mark settlement durable",
		);
	}
}

interface ReconcileResult {
	scanned: number;
	confirmed: number;
	reverted: number;
	stillPending: number;
	stillVerified: number;
	recoveredSettled: number;
	failed: number;
}

/**
 * Ask the chain about every in-flight settlement -- `pending` broadcasts and
 * `verified` payments alike. Resolves rows in place; never throws (the drain
 * runs on a schedule and must survive one bad row).
 */
export async function reconcilePendingSettlements(
	batchSize = 25,
): Promise<ReconcileResult> {
	const result: ReconcileResult = {
		scanned: 0,
		confirmed: 0,
		reverted: 0,
		stillPending: 0,
		stillVerified: 0,
		recoveredSettled: 0,
		failed: 0,
	};

	let due: (typeof pendingSettlements.$inferSelect)[];
	try {
		due = await db
			.select()
			.from(pendingSettlements)
			.where(inArray(pendingSettlements.status, [...IN_FLIGHT_SETTLEMENT_STATES]))
			.orderBy(asc(pendingSettlements.broadcastAt))
			.limit(batchSize);
	} catch (err) {
		logger.error({ err: databaseErrorMetadata(err) }, "[PENDING-SETTLEMENT] could not read in-flight rows");
		return result;
	}

	result.scanned = due.length;
	if (due.length === 0) return result;

	const client = (() => {
		try {
			return getPublicClient();
		} catch (err) {
			logger.error({ err: databaseErrorMetadata(err) }, "[PENDING-SETTLEMENT] no chain client; leaving rows in flight");
			return null;
		}
	})();
	if (!client) {
		for (const row of due) {
			if (row.status === PENDING_SETTLEMENT_STATE.Verified) result.stillVerified++;
			else result.stillPending++;
		}
		return result;
	}

	for (const row of due) {
		try {
			// A durable settlements row is the strongest evidence: the settle
			// step finished and only the durable-mark was lost. Close the row
			// as settled without asking the chain anything.
			const [durable] = await db
				.select({ id: settlements.id })
				.from(settlements)
				.where(and(eq(settlements.txHash, row.txHash), eq(settlements.networkId, row.networkId)))
				.limit(1);
			if (durable) {
				await db
					.update(pendingSettlements)
					.set({
						status: PENDING_SETTLEMENT_STATE.Settled,
						resolvedAt: new Date(),
						lastError: null,
					})
					.where(and(eq(pendingSettlements.id, row.id), inArray(pendingSettlements.status, [...IN_FLIGHT_SETTLEMENT_STATES])));
				result.recoveredSettled++;
				logger.info(
					{ txHash: row.txHash, networkId: row.networkId },
					"[PENDING-SETTLEMENT] settlement already durable; closed verified/pending row as settled",
				);
				continue;
			}

			const receipt = await client.getTransactionReceipt({
				hash: row.txHash as `0x${string}`,
			});
			if (!receipt) {
				// Not mined yet -- genuinely still in flight.
				if (row.status === PENDING_SETTLEMENT_STATE.Verified) result.stillVerified++;
				else result.stillPending++;
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
					.where(and(eq(pendingSettlements.id, row.id), inArray(pendingSettlements.status, [...IN_FLIGHT_SETTLEMENT_STATES])));
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
					.where(and(eq(pendingSettlements.id, row.id), inArray(pendingSettlements.status, [...IN_FLIGHT_SETTLEMENT_STATES])));
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
				.where(and(eq(pendingSettlements.id, row.id), inArray(pendingSettlements.status, [...IN_FLIGHT_SETTLEMENT_STATES])));
			logger.warn(
				{ err: databaseErrorMetadata(err), txHash: row.txHash },
				"[PENDING-SETTLEMENT] reconciliation attempt failed; row stays in flight",
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

/**
 * Depth of every state that still needs an operator's eyes, for the drain
 * route's ops result: `verified` rows the reconciler could not resolve (the
 * crash window this module exists to close) and `confirmed` rows awaiting a
 * credit decision. Before this, only `pending` was counted anywhere, so a
 * stuck verified payment moved no dashboard number.
 */
export async function countSettlementsAwaitingResolution(): Promise<{
	pending: number;
	verified: number;
	confirmed: number;
}> {
	const counts = { pending: 0, verified: 0, confirmed: 0 };
	try {
		const rows = await db
			.select({ status: pendingSettlements.status, count: sql<number>`count(*)::int` })
			.from(pendingSettlements)
			.where(
				inArray(pendingSettlements.status, [
					PENDING_SETTLEMENT_STATE.Pending,
					PENDING_SETTLEMENT_STATE.Verified,
					PENDING_SETTLEMENT_STATE.Confirmed,
				]),
			)
			.groupBy(pendingSettlements.status);
		for (const row of rows) {
			const state = parsePendingSettlementState(row.status);
			if (state === PENDING_SETTLEMENT_STATE.Pending) counts.pending = row.count;
			else if (state === PENDING_SETTLEMENT_STATE.Verified) counts.verified = row.count;
			else if (state === PENDING_SETTLEMENT_STATE.Confirmed) counts.confirmed = row.count;
		}
	} catch (err) {
		logger.error({ err: databaseErrorMetadata(err) }, "[PENDING-SETTLEMENT] could not count awaiting-resolution rows");
	}
	return counts;
}

// The receipt predicate is the same fail-closed rule the x402 paths use.
