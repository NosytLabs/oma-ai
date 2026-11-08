/**
 * Usage record lifecycle — the one explicit state machine for inference outcomes.
 *
 * Before this module the lifecycle was implicit in three places at once:
 *
 *   - `recordUsage` took `status: "completed" | "error" | "aborted"`
 *   - the row that reached Postgres added a FOURTH value on the fly:
 *     `status: skipBilling && status === "completed" ? "free_tier" : status`
 *   - `usage_records.status` is a plain `text` column with default "completed",
 *     so nothing in the schema stopped a typo from becoming a status
 *
 * The four states are now declared once, the in-memory phase and the stored
 * status are separate types, and the free-tier promotion happens in exactly
 * one place (`toStoredUsageStatus`). A writer cannot invent a status; a reader
 * cannot silently pass an unknown one downstream.
 *
 * The lifecycle itself is write-once: a usage row is inserted once
 * (`onConflictDoNothing` on requestId) and every state is terminal. There is
 * no transition table because there are no transitions — that is the point.
 */

/** The phase an in-flight inference ends in, before it is turned into a row. */
export const INFERENCE_PHASE = {
	/** Upstream finished and the answer was delivered. */
	Completed: "completed",
	/** Upstream failed, or the response was incomplete. */
	Error: "error",
	/** The caller went away before the answer completed. */
	Aborted: "aborted",
} as const;

export type InferencePhase = (typeof INFERENCE_PHASE)[keyof typeof INFERENCE_PHASE];

/** Every value that may appear in `usage_records.status`. */
export const USAGE_STATUS = {
	/** Paid (or free-eligible) request that completed and was charged. */
	Completed: "completed",
	/** Completed on the sponsored/free path — not billed to the user. */
	FreeTier: "free_tier",
	/** The request failed. Not billable. */
	Error: "error",
	/** The caller cancelled before completion. Not billable. */
	Aborted: "aborted",
} as const;

export type UsageStatus = (typeof USAGE_STATUS)[keyof typeof USAGE_STATUS];

/** All stored statuses, in a stable order. Used by contract tests and exports. */
export const USAGE_STATUSES: readonly UsageStatus[] = [
	USAGE_STATUS.Completed,
	USAGE_STATUS.FreeTier,
	USAGE_STATUS.Error,
	USAGE_STATUS.Aborted,
];

/** Every status is terminal: usage rows are written once and never transition. */
export function isTerminalUsageStatus(status: UsageStatus): boolean {
	return USAGE_STATUSES.includes(status);
}

/** Only a completed, non-sponsored request is billable. */
export function isBillableUsageStatus(status: UsageStatus): boolean {
	return status === USAGE_STATUS.Completed;
}

/** A failed request — as opposed to a cancelled one. */
export function isFailureUsageStatus(status: UsageStatus): boolean {
	return status === USAGE_STATUS.Error;
}

/** A request that never produced an answer for the caller. */
export function isAbortedUsageStatus(status: UsageStatus): boolean {
	return status === USAGE_STATUS.Aborted;
}

/**
 * The single conversion point from an inference phase to the stored status.
 * Free-tier promotion used to live inline in the insert; now it lives here, so
 * "what does free website chat look like in the ledger" has one answer.
 */
export function toStoredUsageStatus(
	phase: InferencePhase,
	options: { freeTier?: boolean } = {},
): UsageStatus {
	if (options.freeTier && phase === INFERENCE_PHASE.Completed) return USAGE_STATUS.FreeTier;
	return phase;
}

/**
 * Narrows an untrusted value (DB row, webhook payload, query param) to a
 * known status. Returns null instead of guessing — callers decide whether an
 * unknown value is an error to surface or a legacy row to pass through.
 */
export function parseUsageStatus(raw: unknown): UsageStatus | null {
	if (typeof raw !== "string") return null;
	return (USAGE_STATUSES as readonly string[]).includes(raw) ? (raw as UsageStatus) : null;
}

/**
 * Narrows an untrusted value to a known status, falling back to `error` and
 * logging. Used on API responses, where the contract promises one of the
 * known statuses and a legacy/unknown row must not leak through.
 */
export function normalizeUsageStatus(raw: unknown, onUnknown?: (value: unknown) => void): UsageStatus {
	const parsed = parseUsageStatus(raw);
	if (parsed) return parsed;
	onUnknown?.(raw);
	return USAGE_STATUS.Error;
}
