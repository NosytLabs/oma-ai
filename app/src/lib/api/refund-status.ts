/**
 * Client mirror of the server's refund lifecycle vocabulary.
 *
 * The server owns the values (`server/src/lib/refund-status.ts`); this file
 * owns how they are shown. `scripts/check-state-contract.mjs` fails the build
 * when the two const maps disagree.
 *
 * A refund decision is terminal: once granted or denied it never changes, so
 * the UI can stop polling and the badge never flickers back to "Pending".
 */
export const REFUND_STATUS = {
	/** Submitted, waiting for an operator decision. */
	Pending: "pending",
	/** The refund was approved and the credits returned. */
	Granted: "granted",
	/** The refund was refused. */
	Denied: "denied",
} as const;

export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];

/** Every refund status, in lifecycle order. */
export const REFUND_STATUSES = [
	REFUND_STATUS.Pending,
	REFUND_STATUS.Granted,
	REFUND_STATUS.Denied,
] as const;

/** The decisions that close a pending refund. */
export const REFUND_DECISIONS = [
	REFUND_STATUS.Granted,
	REFUND_STATUS.Denied,
] as const;

/** Parse a wire value. Returns null for anything the server never sends. */
export function parseRefundStatus(raw: unknown): RefundStatus | null {
	if (typeof raw !== "string") return null;
	return (REFUND_STATUSES as readonly string[]).includes(raw)
		? (raw as RefundStatus)
		: null;
}

/** True when the refund has been decided. */
export function isTerminalRefundStatus(status: RefundStatus): boolean {
	return status !== REFUND_STATUS.Pending;
}

const LABELS: Record<RefundStatus, string> = {
	[REFUND_STATUS.Pending]: "Pending",
	[REFUND_STATUS.Granted]: "Granted",
	[REFUND_STATUS.Denied]: "Denied",
};

/** Customer-facing label. Unknown statuses read "Unknown". */
export function refundStatusLabel(status: string | null | undefined): string {
	const parsed = parseRefundStatus(status);
	return parsed ? LABELS[parsed] : "Unknown";
}

type RefundStatusTone = "warning" | "success" | "error" | "muted";

const TONES: Record<RefundStatus, RefundStatusTone> = {
	[REFUND_STATUS.Pending]: "warning",
	[REFUND_STATUS.Granted]: "success",
	[REFUND_STATUS.Denied]: "error",
};

/** Badge tone. An unknown status is muted, never a success. */
export function refundStatusTone(
	status: string | null | undefined,
): RefundStatusTone {
	const parsed = parseRefundStatus(status);
	return parsed ? TONES[parsed] : "muted";
}
