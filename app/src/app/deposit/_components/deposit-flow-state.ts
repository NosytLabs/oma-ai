/**
 * Deposit flow state machine (UI side).
 *
 * The deposit screen used to carry its progress as a bare union of string
 * literals (`"select" | "processing" | "complete" | "error"`) set from eight
 * different places, with the rules for which move is legal living only in
 * the call sites. Two consequences: a reader could not tell which moves were
 * intentional, and nothing stopped a stale callback from dragging the screen
 * backwards (for example a wallet prompt resolving after the user had reset
 * the form).
 *
 * This module names the states, the events that move between them and the
 * legal transitions. The component asks for the next state by event name, so
 * the flow is testable on its own and the call sites read as intent
 * ("the transfer was rejected") instead of a magic string.
 *
 * The deposit *lifecycle* on the server (pending → settling → completed …)
 * is a different machine and lives in `app/src/lib/api/deposit-status.ts`.
 */

/** The four screens the deposit flow can show. */
export const DEPOSIT_FLOW_STEP = {
	/** Pick an amount; nothing is in flight. */
	Select: "select",
	/** A transfer is being signed, broadcast or registered. */
	Processing: "processing",
	/** The transfer was registered and is being credited. */
	Complete: "complete",
	/** The transfer failed after it was broadcast (or needs registering). */
	Error: "error",
} as const;

export type DepositFlowStep =
	(typeof DEPOSIT_FLOW_STEP)[keyof typeof DEPOSIT_FLOW_STEP];

/**
 * The events that move the flow.
 *
 * `sync-*` events come from the local "pending deposit" store: it survives a
 * reload, so the screen can come back to a flow that is already running
 * (in flight) or that still needs to be registered (pending).
 */
export type DepositFlowEvent =
	| "submit"
	| "registered"
	| "wallet-rejected"
	| "failed"
	| "retry"
	| "reset"
	| "sync-none"
	| "sync-pending"
	| "sync-in-flight";

/** The step each event leads to. */
export const DEPOSIT_FLOW_EVENT_STEP: Record<
	DepositFlowEvent,
	DepositFlowStep
> = {
	submit: DEPOSIT_FLOW_STEP.Processing,
	registered: DEPOSIT_FLOW_STEP.Complete,
	// A wallet rejection means nothing left the account: go back to the form
	// with an explanation instead of showing a scary error screen.
	"wallet-rejected": DEPOSIT_FLOW_STEP.Select,
	failed: DEPOSIT_FLOW_STEP.Error,
	retry: DEPOSIT_FLOW_STEP.Processing,
	reset: DEPOSIT_FLOW_STEP.Select,
	"sync-none": DEPOSIT_FLOW_STEP.Select,
	"sync-pending": DEPOSIT_FLOW_STEP.Error,
	"sync-in-flight": DEPOSIT_FLOW_STEP.Processing,
};

/**
 * Legal transitions.
 *
 * `complete` and `error` can start a new flow; `processing` can finish,
 * fail, or return to the form when the wallet rejects the transfer.
 */
export const DEPOSIT_FLOW_TRANSITIONS: Record<
	DepositFlowStep,
	readonly DepositFlowStep[]
> = {
	[DEPOSIT_FLOW_STEP.Select]: [DEPOSIT_FLOW_STEP.Processing],
	[DEPOSIT_FLOW_STEP.Processing]: [
		DEPOSIT_FLOW_STEP.Complete,
		DEPOSIT_FLOW_STEP.Error,
		DEPOSIT_FLOW_STEP.Select,
	],
	[DEPOSIT_FLOW_STEP.Complete]: [
		DEPOSIT_FLOW_STEP.Select,
		DEPOSIT_FLOW_STEP.Processing,
	],
	[DEPOSIT_FLOW_STEP.Error]: [
		DEPOSIT_FLOW_STEP.Select,
		DEPOSIT_FLOW_STEP.Processing,
	],
};

/** The step an event leads to. */
export function depositFlowStepFor(event: DepositFlowEvent): DepositFlowStep {
	return DEPOSIT_FLOW_EVENT_STEP[event];
}

/** True when `next` is a legal successor of `current`. */
export function canTransitionDepositFlow(
	current: DepositFlowStep,
	next: DepositFlowStep,
): boolean {
	return DEPOSIT_FLOW_TRANSITIONS[current].includes(next);
}

/** True while a transfer is being signed, broadcast or registered. */
export function isDepositFlowBusy(step: DepositFlowStep): boolean {
	return step === DEPOSIT_FLOW_STEP.Processing;
}

/** Progress index for the stepper: 0 = pick amount, 1 = verify, 2 = done. */
export function depositFlowStepIndex(step: DepositFlowStep): number {
	switch (step) {
		case DEPOSIT_FLOW_STEP.Select:
			return 0;
		case DEPOSIT_FLOW_STEP.Processing:
			return 1;
		case DEPOSIT_FLOW_STEP.Complete:
			return 2;
		case DEPOSIT_FLOW_STEP.Error:
			// An error sits on the verify step: the money may already be out.
			return 1;
	}
}
