/**
 * Model availability policy.
 *
 * Availability used to be a boolean on the model row, which left four
 * different causes indistinguishable to a client: an operator pause, a policy
 * block, a missing provider credential and an unknown provider. A client that
 * only sees `available: false` can only show a generic notice, so the cause
 * is now named.
 *
 * Deliberately its OWN module rather than part of `models.ts`: availability is
 * a RULE, not catalog data. Tests and callers routinely mock the catalog
 * module wholesale; when the rule lived inside it, such a mock silently
 * removed the rule and the caller fell back to "everything is available".
 */
import { config } from "../config.js";
import {
	MODEL_UNAVAILABILITY_CAUSE,
	type ModelUnavailabilityCause,
} from "./model-unavailability-cause.js";
import { isModelPrivacyAllowed } from "./provider-route.js";
import type { ModelDef } from "./models.js";

/**
 * The availability state of a model, with the reason it is unavailable.
 */
interface ModelAvailability {
	/** Whether the model can be called right now. */
	available: boolean;
	/** Why it cannot. Absent when the model is available. */
	cause?: ModelUnavailabilityCause;
	/** Operator-facing explanation, when there is one. */
	reason?: string;
}

/**
 * Whether a model can be called right now, and why not.
 *
 * Venice models report unavailable when VENICE_API_KEY is missing or a known
 * placeholder so clients can grey them out instead of surfacing a raw
 * upstream 401. OMA-AI models check their specific upstream key.
 */
export function modelAvailability(m: ModelDef): ModelAvailability {
	if (m.disabledReason) {
		return {
			available: false,
			cause: MODEL_UNAVAILABILITY_CAUSE.Disabled,
			reason: m.disabledReason,
		};
	}
	if (!isModelPrivacyAllowed(m)) {
		return { available: false, cause: MODEL_UNAVAILABILITY_CAUSE.PolicyBlocked };
	}
	if (m.provider === "venice") {
		return isConfiguredKey(config.VENICE_API_KEY)
			? { available: true }
			: { available: false, cause: MODEL_UNAVAILABILITY_CAUSE.MissingCredential };
	}
	if (m.provider === "oma-ai") {
		// Only "openbroker" upstream remains after Zyloo removal (2026-08-17).
		return isConfiguredKey(config.OPENBROKER_API_KEY)
			? { available: true }
			: { available: false, cause: MODEL_UNAVAILABILITY_CAUSE.MissingCredential };
	}
	return { available: false, cause: MODEL_UNAVAILABILITY_CAUSE.UnknownProvider };
}

function isConfiguredKey(key: string | undefined): boolean {
	if (!key || key.length < 16) return false;
	if (/placeholder|changeme|your-key|example/i.test(key)) return false;
	// Only reject obvious dummy prefixes -- real Venice keys start with VENICE_.
	if (/^(plch-|your-|dev-)/i.test(key)) return false;
	if (/^(openbroker_|surplus_)(placeh|changeme|your|xxx|dummy)/i.test(key)) {
		return false;
	}
	return true;
}
