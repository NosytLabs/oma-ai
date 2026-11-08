/**
 * Deposit lifecycle vocabulary.
 *
 * `deposits.status` is a Postgres enum (`deposit_status`), so the database
 * refuses unknown values — but nothing in TypeScript knew the vocabulary:
 * the values were scattered as bare string literals across the deposit route,
 * the credit-settlement helper and the recovery worker, and the client
 * carried a second, independent copy in `app/src/lib/api/deposit.ts` plus a
 * third label map in `app/src/lib/deposit-status.ts`.
 *
 * This module is the single server-side source of truth. The client mirror
 * lives in `app/src/lib/api/deposit-status.ts`; `scripts/check-state-contract.mjs`
 * fails the build when the two drift.
 *
 * Wire values are unchanged — they are the enum's values, byte for byte.
 */
export const DEPOSIT_STATUS = {
	Pending: "pending",
	Settling: "settling",
	Completed: "completed",
	Failed: "failed",
	Expired: "expired",
	Refunded: "refunded",
} as const;

export type DepositStatus = (typeof DEPOSIT_STATUS)[keyof typeof DEPOSIT_STATUS];

/** Every deposit status, in lifecycle order. */
export const DEPOSIT_STATUSES = [
	DEPOSIT_STATUS.Pending,
	DEPOSIT_STATUS.Settling,
	DEPOSIT_STATUS.Completed,
	DEPOSIT_STATUS.Failed,
	DEPOSIT_STATUS.Expired,
	DEPOSIT_STATUS.Refunded,
] as const;

/**
 * Statuses that mean "no further automatic movement".
 *
 * `pending` and `settling` still resolve on their own (the recovery worker
 * polls the chain); `completed`, `failed`, `expired` and `refunded` are
 * decided. A terminal deposit must never be re-read as in-flight.
 */
export const TERMINAL_DEPOSIT_STATUSES: readonly DepositStatus[] = [
	DEPOSIT_STATUS.Completed,
	DEPOSIT_STATUS.Failed,
	DEPOSIT_STATUS.Expired,
	DEPOSIT_STATUS.Refunded,
];

/** Statuses where the deposit is still working its way to a decision. */
export const PENDING_DEPOSIT_STATUSES: readonly DepositStatus[] = [
	DEPOSIT_STATUS.Pending,
	DEPOSIT_STATUS.Settling,
];

/**
 * Legal transitions.
 *
 * `pending` covers "submitted, not yet confirmed on chain"; `settling` is
 * reserved for a confirmed-but-not-yet-credited transfer. The server does
 * not currently write `settling` (the enum allows it and the client renders
 * it), so the transition table documents the intended lifecycle rather than
 * inventing behaviour.
 *
 * A terminal deposit is decided, but `completed` can still move to
 * `refunded` — a refund is a later fact about a settled deposit, not a
 * continuation of the deposit flow.
 */
export const DEPOSIT_STATUS_TRANSITIONS: Record<
	DepositStatus,
	readonly DepositStatus[]
> = {
	[DEPOSIT_STATUS.Pending]: [
		DEPOSIT_STATUS.Settling,
		DEPOSIT_STATUS.Completed,
		DEPOSIT_STATUS.Failed,
		DEPOSIT_STATUS.Expired,
	],
	[DEPOSIT_STATUS.Settling]: [
		DEPOSIT_STATUS.Completed,
		DEPOSIT_STATUS.Failed,
		DEPOSIT_STATUS.Expired,
	],
	[DEPOSIT_STATUS.Completed]: [DEPOSIT_STATUS.Refunded],
	[DEPOSIT_STATUS.Failed]: [],
	[DEPOSIT_STATUS.Expired]: [],
	[DEPOSIT_STATUS.Refunded]: [],
};

/** Parse a wire value. Returns null for anything the server never sends. */
export function parseDepositStatus(raw: unknown): DepositStatus | null {
	if (typeof raw !== "string") return null;
	return (DEPOSIT_STATUSES as readonly string[]).includes(raw)
		? (raw as DepositStatus)
		: null;
}

/** True when the deposit has reached a decided state. */
export function isTerminalDepositStatus(status: DepositStatus): boolean {
	return TERMINAL_DEPOSIT_STATUSES.includes(status);
}

/** True when the deposit is still in flight. */
export function isPendingDepositStatus(status: DepositStatus): boolean {
	return PENDING_DEPOSIT_STATUSES.includes(status);
}

/** True when `next` is a legal successor of `current`. */
export function canTransitionDepositStatus(
	current: DepositStatus,
	next: DepositStatus,
): boolean {
	return DEPOSIT_STATUS_TRANSITIONS[current].includes(next);
}
