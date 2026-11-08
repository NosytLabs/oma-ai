/**
 * Client mirror of the server's deposit lifecycle vocabulary.
 *
 * The server owns the values (`server/src/lib/deposit-status.ts`); this file
 * owns how they are shown. `scripts/check-state-contract.mjs` fails the build
 * when the two const maps disagree, so a status added on the server cannot
 * silently arrive here as "Unknown".
 *
 * Unknown values (a newer server, a legacy row) never render as a success:
 * they degrade to the muted tone and the "Unknown" label.
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

/** Statuses that mean the deposit has reached a decided state. */
const TERMINAL_DEPOSIT_STATUSES: readonly DepositStatus[] = [
	DEPOSIT_STATUS.Completed,
	DEPOSIT_STATUS.Failed,
	DEPOSIT_STATUS.Expired,
	DEPOSIT_STATUS.Refunded,
];

/** Statuses where the deposit is still working towards a decision. */
const PENDING_DEPOSIT_STATUSES: readonly DepositStatus[] = [
	DEPOSIT_STATUS.Pending,
	DEPOSIT_STATUS.Settling,
];

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

const LABELS: Record<DepositStatus, string> = {
	[DEPOSIT_STATUS.Pending]: "Pending",
	[DEPOSIT_STATUS.Settling]: "Confirming",
	[DEPOSIT_STATUS.Completed]: "Completed",
	[DEPOSIT_STATUS.Failed]: "Failed",
	[DEPOSIT_STATUS.Expired]: "Expired",
	[DEPOSIT_STATUS.Refunded]: "Refunded",
};

/** Customer-facing label. Unknown statuses read "Unknown", never "Completed". */
export function depositStatusLabel(status: string | null | undefined): string {
	const parsed = parseDepositStatus(status);
	return parsed ? LABELS[parsed] : "Unknown";
}

export type DepositStatusTone = "success" | "warning" | "error" | "muted";

const TONES: Record<DepositStatus, DepositStatusTone> = {
	[DEPOSIT_STATUS.Pending]: "warning",
	[DEPOSIT_STATUS.Settling]: "warning",
	[DEPOSIT_STATUS.Completed]: "success",
	[DEPOSIT_STATUS.Failed]: "error",
	[DEPOSIT_STATUS.Expired]: "muted",
	[DEPOSIT_STATUS.Refunded]: "muted",
};

/**
 * Badge tone for a deposit status.
 *
 * A refunded deposit is deliberately muted rather than red: the money went
 * back to the user, that is not an error.
 */
export function depositStatusTone(
	status: string | null | undefined,
): DepositStatusTone {
	const parsed = parseDepositStatus(status);
	return parsed ? TONES[parsed] : "muted";
}
