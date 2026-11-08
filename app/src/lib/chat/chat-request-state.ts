/**
 * The chat request machine.
 *
 * The playground used to carry the request lifecycle in two unrelated places:
 * a `loading` boolean in component state, and a non-null `abortRef.current`
 * meaning "a request is in flight". Nothing tied them together, so "the
 * composer is disabled" and "a request is running" could disagree — and the
 * error message ("stuck" hint after 15s) had no way to say WHICH state the
 * request was in.
 *
 * This module is the single explicit description of the lifecycle. `phase` is
 * the state; `loading` is a DERIVED view of it, so the two can never
 * disagree. The transition table is explicit so an invalid move (streaming →
 * sending) is a decision rather than an accident.
 *
 * Phases:
 *
 *   idle ──send──▶ sending ──first token──▶ streaming ──settle──▶ idle
 *                     │                        │
 *                     ├──fail──▶ failed        ├──fail──▶ failed
 *                     └──cancel──▶ canceled    └──cancel──▶ canceled
 *
 * `failed` and `canceled` are terminal but NOT idle: the UI shows them until
 * the next send, so a cancelled run is visibly cancelled rather than looking
 * like it never happened.
 */

export const CHAT_REQUEST_PHASE = {
	/** Nothing in flight. */
	Idle: "idle",
	/** Request sent, waiting for the first token. */
	Sending: "sending",
	/** Tokens are arriving. */
	Streaming: "streaming",
	/** The request failed. Terminal until the next send. */
	Failed: "failed",
	/** The caller cancelled. Terminal until the next send. */
	Canceled: "canceled",
} as const;

export type ChatRequestPhase = (typeof CHAT_REQUEST_PHASE)[keyof typeof CHAT_REQUEST_PHASE];

/** Events that move the request machine. */
export const CHAT_REQUEST_EVENT = {
	/** The user pressed send. */
	Send: "send",
	/** The first token of the answer arrived. */
	FirstToken: "first-token",
	/** The request ended normally. */
	Settled: "settled",
	/** The request failed. */
	Fail: "fail",
	/** The request was cancelled. */
	Cancel: "cancel",
} as const;

type ChatRequestEvent = (typeof CHAT_REQUEST_EVENT)[keyof typeof CHAT_REQUEST_EVENT];

export interface ChatRequestState {
	phase: ChatRequestPhase;
	/** Message for the `failed` phase. Null otherwise. */
	error: string | null;
}

export const INITIAL_CHAT_REQUEST_STATE: ChatRequestState = {
	phase: CHAT_REQUEST_PHASE.Idle,
	error: null,
};

/**
 * The transition table. Anything not listed is rejected by falling back to
 * the current phase — an out-of-order event must not teleport the machine.
 */
const TRANSITIONS: Record<ChatRequestPhase, Partial<Record<ChatRequestEvent, ChatRequestPhase>>> = {
	[CHAT_REQUEST_PHASE.Idle]: {
		[CHAT_REQUEST_EVENT.Send]: CHAT_REQUEST_PHASE.Sending,
		// A cancel can land on an already-idle machine when the request
		// settled before the abort was observed.
		[CHAT_REQUEST_EVENT.Cancel]: CHAT_REQUEST_PHASE.Canceled,
	},
	[CHAT_REQUEST_PHASE.Sending]: {
		[CHAT_REQUEST_EVENT.FirstToken]: CHAT_REQUEST_PHASE.Streaming,
		[CHAT_REQUEST_EVENT.Settled]: CHAT_REQUEST_PHASE.Idle,
		[CHAT_REQUEST_EVENT.Fail]: CHAT_REQUEST_PHASE.Failed,
		[CHAT_REQUEST_EVENT.Cancel]: CHAT_REQUEST_PHASE.Canceled,
	},
	[CHAT_REQUEST_PHASE.Streaming]: {
		[CHAT_REQUEST_EVENT.Settled]: CHAT_REQUEST_PHASE.Idle,
		[CHAT_REQUEST_EVENT.Fail]: CHAT_REQUEST_PHASE.Failed,
		[CHAT_REQUEST_EVENT.Cancel]: CHAT_REQUEST_PHASE.Canceled,
	},
	// Terminal phases only leave on a new send.
	[CHAT_REQUEST_PHASE.Failed]: {
		[CHAT_REQUEST_EVENT.Send]: CHAT_REQUEST_PHASE.Sending,
	},
	[CHAT_REQUEST_PHASE.Canceled]: {
		[CHAT_REQUEST_EVENT.Send]: CHAT_REQUEST_PHASE.Sending,
	},
};

/** Applies an event to a phase, ignoring events that do not apply. */
export function nextChatRequestPhase(
	phase: ChatRequestPhase,
	event: ChatRequestEvent,
): ChatRequestPhase {
	return TRANSITIONS[phase][event] ?? phase;
}

/** Applies an event to a whole state. */
export function applyChatRequestEvent(
	state: ChatRequestState,
	event: ChatRequestEvent,
	error: string | null = null,
): ChatRequestState {
	const phase = nextChatRequestPhase(state.phase, event);
	if (phase === state.phase && error === state.error) return state;
	return { phase, error: phase === CHAT_REQUEST_PHASE.Failed ? error : null };
}

/** True while a request is in flight (composer disabled, Stop button live). */
export function isChatRequestInFlight(state: ChatRequestState): boolean {
	return state.phase === CHAT_REQUEST_PHASE.Sending || state.phase === CHAT_REQUEST_PHASE.Streaming;
}

/** True when a new message may be sent. */
export function canSendChatRequest(state: ChatRequestState): boolean {
	return !isChatRequestInFlight(state);
}

/** Short human label for the current phase — used by the composer and toasts. */
export function chatRequestPhaseLabel(state: ChatRequestState): string {
	switch (state.phase) {
		case CHAT_REQUEST_PHASE.Idle:
			return "Ready";
		case CHAT_REQUEST_PHASE.Sending:
			return "Sending…";
		case CHAT_REQUEST_PHASE.Streaming:
			return "Streaming…";
		case CHAT_REQUEST_PHASE.Failed:
			return "Failed";
		case CHAT_REQUEST_PHASE.Canceled:
			return "Canceled";
		default:
			return "Ready";
	}
}
