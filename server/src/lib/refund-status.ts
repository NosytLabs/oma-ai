/**
 * Refund request lifecycle vocabulary.
 *
 * `refund_requests.status` is a Postgres enum (`refund_status`) with three
 * values, and the same three values were re-typed by hand in the route
 * schemas (`z.enum(["pending", "granted", "denied"])` in two places, plus a
 * decision enum). A fourth value would have been accepted by the database
 * and rejected by the route — or worse, the other way round.
 *
 * This module owns the vocabulary; the route schemas derive from it, so the
 * enum, the schema and the queries can no longer disagree.
 */
export const REFUND_STATUS = {
	Pending: "pending",
	Granted: "granted",
	Denied: "denied",
} as const;

export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];

/** Every refund status, in lifecycle order. */
export const REFUND_STATUSES = [
	REFUND_STATUS.Pending,
	REFUND_STATUS.Granted,
	REFUND_STATUS.Denied,
] as const;

/** The admin decisions that close a pending refund. */
export const REFUND_DECISIONS = [
	REFUND_STATUS.Granted,
	REFUND_STATUS.Denied,
] as const;

export type RefundDecision = (typeof REFUND_DECISIONS)[number];

/**
 * Legal transitions.
 *
 * A refund decision is terminal — the request row is never re-decided, so a
 * second admin decision on the same request is a 409, not a state change.
 */
export const REFUND_STATUS_TRANSITIONS: Record<
	RefundStatus,
	readonly RefundStatus[]
> = {
	[REFUND_STATUS.Pending]: [REFUND_STATUS.Granted, REFUND_STATUS.Denied],
	[REFUND_STATUS.Granted]: [],
	[REFUND_STATUS.Denied]: [],
};

/** Parse a wire/DB value. Returns null for anything unknown. */
export function parseRefundStatus(raw: unknown): RefundStatus | null {
	if (typeof raw !== "string") return null;
	return (REFUND_STATUSES as readonly string[]).includes(raw)
		? (raw as RefundStatus)
		: null;
}

/** True when the refund has been decided (granted or denied). */
export function isTerminalRefundStatus(status: RefundStatus): boolean {
	return status !== REFUND_STATUS.Pending;
}

/** True when `next` is a legal successor of `current`. */
export function canTransitionRefundStatus(
	current: RefundStatus,
	next: RefundStatus,
): boolean {
	return REFUND_STATUS_TRANSITIONS[current].includes(next);
}
