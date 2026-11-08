/**
 * Idempotency claim lifecycle vocabulary.
 *
 * `inference_request_claims.state` is a plain `text` column with a CHECK
 * constraint (`in ('pending','completed')`) — the constraint lives in SQL, so
 * the vocabulary was invisible to TypeScript and re-typed as bare literals
 * in the idempotency middleware.
 *
 * A third outcome exists that is NOT a stored value: when a request ends
 * without being billed, the claim row is deleted so the same idempotency key
 * can be retried. That release is modelled here as `Released` so callers
 * stop treating "row absent" as an accident rather than a transition.
 */
export const CLAIM_STATE = {
	/** The key is admitted and the request is running (or finished but unbilled). */
	Pending: "pending",
	/** The request was billed; the key must never be replayed. */
	Completed: "completed",
} as const;

type ClaimState = (typeof CLAIM_STATE)[keyof typeof CLAIM_STATE];

/**
 * The outcome that is represented by the absence of a row rather than by a
 * stored value. Kept out of `CLAIM_STATE` on purpose: `Released` is not a
 * state the database can hold.
 */
export const CLAIM_RELEASED = "released" as const;

/** Every stored claim state. */
export const CLAIM_STATES = [CLAIM_STATE.Pending, CLAIM_STATE.Completed] as const;

/**
 * Legal transitions.
 *
 * `pending` → `completed` happens when the request is billed. `pending` →
 * released (row deleted) happens when the request ends unbilled and the key
 * may be reused. `completed` is terminal.
 */
export const CLAIM_STATE_TRANSITIONS: Record<
	ClaimState | typeof CLAIM_RELEASED,
	readonly (ClaimState | typeof CLAIM_RELEASED)[]
> = {
	[CLAIM_STATE.Pending]: [CLAIM_STATE.Completed, CLAIM_RELEASED],
	[CLAIM_STATE.Completed]: [],
	[CLAIM_RELEASED]: [],
};

/** Parse a stored value. Returns null for anything unknown. */
export function parseClaimState(raw: unknown): ClaimState | null {
	if (typeof raw !== "string") return null;
	return (CLAIM_STATES as readonly string[]).includes(raw)
		? (raw as ClaimState)
		: null;
}

/**
 * True when the key must not be replayed.
 *
 * A completed claim means the request was billed. A pending claim whose
 * 5-minute lease expired may be re-admitted — the admission query checks
 * the expiry itself.
 */
export function isReplayBlockedClaimState(state: ClaimState): boolean {
	return state === CLAIM_STATE.Completed;
}

/** True when `next` is a legal successor of `current`. */
export function canTransitionClaimState(
	current: ClaimState | typeof CLAIM_RELEASED,
	next: ClaimState | typeof CLAIM_RELEASED,
): boolean {
	return CLAIM_STATE_TRANSITIONS[current].includes(next);
}
