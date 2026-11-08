/**
 * Usage status vocabulary (client side).
 *
 * The API returns one of four terminal statuses per usage row. They used to be
 * open-coded at the render site as a nested ternary:
 *
 *   refundedAt ? "Refunded"
 *     : status === "free_tier" ? "Free chat"
 *     : status === "aborted" ? "Canceled"
 *     : status === "error" ? "Error"
 *     : "Completed"
 *
 * which meant an unknown status silently rendered as "Completed" — the most
 * reassuring label available. Every consumer now asks this module instead, so
 * the human-readable meaning of a status lives in exactly one place, and an
 * unrecognised value degrades to "Unknown" rather than lying.
 *
 * The values are mirrored from `server/src/lib/usage-status.ts`. The two lists
 * are kept in sync by `scripts/check-state-contract.mjs`, which fails CI if
 * the client and server ever disagree about the vocabulary.
 */

export const USAGE_STATUS = {
	/** Paid request that completed and was charged. */
	Completed: "completed",
	/** Completed on the sponsored/free path — not billed to the user. */
	FreeTier: "free_tier",
	/** The request failed. Not billable. */
	Error: "error",
	/** The caller cancelled before completion. Not billable. */
	Aborted: "aborted",
} as const;

export type UsageStatus = (typeof USAGE_STATUS)[keyof typeof USAGE_STATUS];

export const USAGE_STATUSES: readonly UsageStatus[] = [
	USAGE_STATUS.Completed,
	USAGE_STATUS.FreeTier,
	USAGE_STATUS.Error,
	USAGE_STATUS.Aborted,
];

/** Visual weight of a status in the UI. */
export type UsageStatusTone = "success" | "muted" | "danger";

/**
 * Accepts the union plus any future string, so a server that adds a status
 * before the client is updated still renders (as "Unknown") instead of
 * crashing a dashboard on a truthy check.
 */
export function parseUsageStatus(raw: unknown): UsageStatus | null {
	if (typeof raw !== "string") return null;
	return (USAGE_STATUSES as readonly string[]).includes(raw) ? (raw as UsageStatus) : null;
}

/** True only for a completed, billable request. */
export function isBillableUsageStatus(status: string): boolean {
	return status === USAGE_STATUS.Completed;
}

/** A failed request, as opposed to a cancelled one. */
export function isFailureUsageStatus(status: string): boolean {
	return status === USAGE_STATUS.Error;
}

/** The human-readable label for a status. Unknown values say so. */
export function usageStatusLabel(status: string): string {
	switch (status) {
		case USAGE_STATUS.Completed:
			return "Completed";
		case USAGE_STATUS.FreeTier:
			return "Free chat";
		case USAGE_STATUS.Error:
			return "Error";
		case USAGE_STATUS.Aborted:
			return "Canceled";
		default:
			return "Unknown";
	}
}

/** The tone a status should be rendered with. */
export function usageStatusTone(status: string): UsageStatusTone {
	switch (status) {
		case USAGE_STATUS.Completed:
			return "success";
		case USAGE_STATUS.Error:
			return "danger";
		default:
			return "muted";
	}
}
