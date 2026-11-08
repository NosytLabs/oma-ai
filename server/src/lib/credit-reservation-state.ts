/**
 * Credit reservation / financial receipt lifecycle vocabulary.
 *
 * `inference_credit_reservations.state` and `inference_financial_receipts.state`
 * are plain `text` columns (no enum, no CHECK constraint), and their values
 * were written as raw SQL string literals in six places: `'held'`,
 * `'released'`, `'reconciliation'`, `'settled'`. A typo in one of them is
 * silent: the UPDATE simply matches zero rows and the hold is never
 * released, so the user's credits stay reserved forever with no error
 * anywhere.
 *
 * This module names the vocabulary and the legal transitions so a hold can
 * never be written in a state the reader does not understand.
 */
export const RESERVATION_STATE = {
	/** Credits are held for an in-flight inference. */
	Held: "held",
	/** The hold was released and the credits returned to the balance. */
	Released: "released",
	/**
	 * The outcome was ambiguous (timeout, cancelled stream, provider
	 * overcharge). The hold is retained because the provider may still have
	 * billed us — a human or the reconciliation job must settle it.
	 */
	Reconciliation: "reconciliation",
	/** The inference was billed; the receipt is final. */
	Settled: "settled",
} as const;

type ReservationState =
	(typeof RESERVATION_STATE)[keyof typeof RESERVATION_STATE];

/** Every reservation state. */
export const RESERVATION_STATES = [
	RESERVATION_STATE.Held,
	RESERVATION_STATE.Released,
	RESERVATION_STATE.Reconciliation,
	RESERVATION_STATE.Settled,
] as const;

/**
 * States where money may still be owed.
 *
 * A `held` or `reconciliation` reservation is a live claim on the user's
 * balance: retrying the request with the same id must not release it, and
 * the idempotency guard treats it as "possibly already billed".
 */
export const OPEN_RESERVATION_STATES: readonly ReservationState[] = [
	RESERVATION_STATE.Held,
	RESERVATION_STATE.Reconciliation,
];

/**
 * Legal transitions.
 *
 * `held` can settle, be released (safe: the provider never ran) or be
 * parked in `reconciliation` (ambiguous). `reconciliation` can only be
 * settled — the ambiguity is resolved by evidence, never by giving the
 * money back silently. Released and settled are terminal.
 */
export const RESERVATION_STATE_TRANSITIONS: Record<
	ReservationState,
	readonly ReservationState[]
> = {
	[RESERVATION_STATE.Held]: [
		RESERVATION_STATE.Released,
		RESERVATION_STATE.Reconciliation,
		RESERVATION_STATE.Settled,
	],
	[RESERVATION_STATE.Reconciliation]: [
		RESERVATION_STATE.Reconciliation,
		RESERVATION_STATE.Settled,
	],
	[RESERVATION_STATE.Released]: [],
	[RESERVATION_STATE.Settled]: [],
};

/** Parse a stored value. Returns null for anything unknown. */
export function parseReservationState(raw: unknown): ReservationState | null {
	if (typeof raw !== "string") return null;
	return (RESERVATION_STATES as readonly string[]).includes(raw)
		? (raw as ReservationState)
		: null;
}

/** True when the reservation still claims (or may claim) the user's money. */
export function isOpenReservationState(state: ReservationState): boolean {
	return OPEN_RESERVATION_STATES.includes(state);
}

/** True when `next` is a legal successor of `current`. */
export function canTransitionReservationState(
	current: ReservationState,
	next: ReservationState,
): boolean {
	return RESERVATION_STATE_TRANSITIONS[current].includes(next);
}
