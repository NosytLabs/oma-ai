/**
 * Inference attempt failure outcome.
 *
 * When an inference request fails, the open question is what to do with the
 * credit reservation that was held for it:
 *
 *  - the provider never started, so nothing was charged and the reservation
 *    can be released back to the user;
 *  - the provider explicitly rejected the request, so again nothing was
 *    charged;
 *  - the provider failed after work started and the billing state is
 *    uncertain, so the reservation must be reconciled by hand rather than
 *    silently released or silently kept.
 *
 * That decision was written as one inline boolean expression and duplicated
 * across the chat and Anthropic-compatible routes, where the two copies could
 * drift. It lives here now, named, with the release rule next to it.
 */

/** The named outcome of a failed inference attempt. */
export const INFERENCE_FAILURE_OUTCOME = {
	/** The provider was never reached: no work, no charge. */
	NotStarted: "not_started",
	/** The provider explicitly rejected the request: no work, no charge. */
	Rejected: "rejected",
	/** The provider may have charged us despite the failure. */
	BillingUncertain: "billing_uncertain",
	/** The provider failed after work started; the charge state is unknown. */
	Failed: "failed",
} as const;

export type InferenceFailureOutcome =
	(typeof INFERENCE_FAILURE_OUTCOME)[keyof typeof INFERENCE_FAILURE_OUTCOME];

/** The signals a failed attempt produced. */
export interface InferenceFailureInput {
	/** The provider was reached and started work. */
	providerStarted: boolean;
	/** The provider explicitly rejected the request before doing work. */
	executionRejected: boolean;
	/** The provider may have charged us despite the failure. */
	billingUncertain: boolean;
}

/**
 * Classify a failed attempt.
 *
 * Billing uncertainty wins over an explicit rejection: even when the provider
 * says it rejected the request, an uncertain charge means the reservation
 * has to be reconciled rather than released.
 */
export function inferenceFailureOutcome(
	input: InferenceFailureInput,
): InferenceFailureOutcome {
	if (!input.providerStarted) return INFERENCE_FAILURE_OUTCOME.NotStarted;
	if (input.billingUncertain) return INFERENCE_FAILURE_OUTCOME.BillingUncertain;
	if (input.executionRejected) return INFERENCE_FAILURE_OUTCOME.Rejected;
	return INFERENCE_FAILURE_OUTCOME.Failed;
}

/**
 * Whether the held reservation can be released back to the user.
 *
 * Only outcomes that provably did not charge the user qualify; everything
 * else stays reserved for reconciliation.
 */
export function shouldReleaseInferenceReservation(
	outcome: InferenceFailureOutcome,
): boolean {
	return (
		outcome === INFERENCE_FAILURE_OUTCOME.NotStarted ||
		outcome === INFERENCE_FAILURE_OUTCOME.Rejected
	);
}
