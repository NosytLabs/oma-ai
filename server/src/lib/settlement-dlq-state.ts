/**
 * Settlement DLQ retry state.
 *
 * A queued settlement has no status column: its state was implied by three
 * numbers on the row — `attempts`, `nextAttemptAt` and `lastError`. An entry
 * with `attempts` below the ceiling is waiting for its next retry; an entry
 * that reached the ceiling is abandoned and only a human can reconcile it; a
 * recovered entry is deleted from the queue.
 *
 * The column set stays as it is (it is a durable financial record), but the
 * state is named here so the drain loop, the queue writer and the ops
 * surfaces all agree on what an entry is.
 */

/** The states a queued settlement can be in. */
export const SETTLEMENT_DLQ_STATE = {
	/** The entry is waiting for its next retry. */
	Pending: "pending",
	/**
	 * The entry exhausted its retries. The receipt is retained for manual
	 * reconciliation; the queue will not touch it again.
	 */
	Abandoned: "abandoned",
} as const;

type SettlementDlqState =
	(typeof SETTLEMENT_DLQ_STATE)[keyof typeof SETTLEMENT_DLQ_STATE];

/** Retries before an entry is abandoned for manual reconciliation. */
export const SETTLEMENT_DLQ_MAX_ATTEMPTS = 12;

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60_000;

/** Exponential backoff between retries, capped. */
export function settlementDlqBackoffMs(attempts: number): number {
	return Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
}

/** True once an entry has used up its retries. */
export function isSettlementDlqAbandoned(attempts: number): boolean {
	return attempts >= SETTLEMENT_DLQ_MAX_ATTEMPTS;
}

/** The state of a queued entry with the given attempt count. */
export function settlementDlqState(attempts: number): SettlementDlqState {
	return isSettlementDlqAbandoned(attempts)
		? SETTLEMENT_DLQ_STATE.Abandoned
		: SETTLEMENT_DLQ_STATE.Pending;
}
