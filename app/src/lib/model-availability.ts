/**
 * Model availability policy.
 *
 * Deliberately its OWN module rather than part of `models-data`: tests and
 * consumers routinely mock `models-data` wholesale (e.g. to supply a small
 * fake catalog). When this predicate lived there, such a mock silently removed
 * it, the caller threw a TypeError, and an enclosing `try/catch` turned that
 * into a wrong-but-plausible fallback. Availability is a RULE, not catalog
 * data, so it must not be mockable away.
 *
 * The API field is optional and an OMITTED flag means available, so only an
 * explicit `false` counts as offline. This rule was open-coded as
 * `available !== false` in ten call sites (catalog counts, pricing, sitemap,
 * llms.txt, agent card, admin, hero, docs), where a one-character drift would
 * silently disagree about how many models the product claims to have.
 */

interface AvailabilityFlag {
	available?: boolean;
}

export function isModelAvailable(model: AvailabilityFlag): boolean {
	return model.available !== false;
}

/** The subset of `models` that is currently accepting requests. */
export function selectAvailableModels<T extends AvailabilityFlag>(
	models: readonly T[],
): T[] {
	return models.filter(isModelAvailable);
}

/**
 * Why a model cannot be called right now.
 *
 * The server used to collapse four different causes into one boolean, so a
 * client could only show a generic "Unavailable" notice. The cause is now
 * named, so the site can say what is actually wrong.
 */
export const MODEL_UNAVAILABILITY_CAUSE = {
	/** An operator paused the model; the catalog carries the reason. */
	Disabled: "disabled",
	/** The provider credential is missing or still a placeholder. */
	MissingCredential: "missing_credential",
	/** The deployment policy blocks this provider route. */
	PolicyBlocked: "policy_blocked",
	/** The catalog names a provider this server does not know. */
	UnknownProvider: "unknown_provider",
} as const;

export type ModelUnavailabilityCause =
	(typeof MODEL_UNAVAILABILITY_CAUSE)[keyof typeof MODEL_UNAVAILABILITY_CAUSE];

/** Every unavailability cause, in wire order. */
const MODEL_UNAVAILABILITY_CAUSES: readonly ModelUnavailabilityCause[] = [
	MODEL_UNAVAILABILITY_CAUSE.Disabled,
	MODEL_UNAVAILABILITY_CAUSE.MissingCredential,
	MODEL_UNAVAILABILITY_CAUSE.PolicyBlocked,
	MODEL_UNAVAILABILITY_CAUSE.UnknownProvider,
];

/** Parse an unavailability cause. Returns `null` for an unknown value. */
export function parseModelUnavailabilityCause(
	raw: unknown,
): ModelUnavailabilityCause | null {
	return (MODEL_UNAVAILABILITY_CAUSES as readonly unknown[]).includes(raw)
		? (raw as ModelUnavailabilityCause)
		: null;
}

/**
 * A short, human explanation of an unavailability cause.
 *
 * Returns `null` for an unknown cause: the caller then shows its generic
 * copy rather than inventing a reason.
 */
export function modelUnavailabilityCauseLabel(
	cause: ModelUnavailabilityCause | null | undefined,
): string | null {
	switch (cause) {
		case MODEL_UNAVAILABILITY_CAUSE.Disabled:
			return "Paused by an operator";
		case MODEL_UNAVAILABILITY_CAUSE.MissingCredential:
			return "No provider credential configured for this deployment";
		case MODEL_UNAVAILABILITY_CAUSE.PolicyBlocked:
			return "Blocked by this deployment's provider policy";
		case MODEL_UNAVAILABILITY_CAUSE.UnknownProvider:
			return "Provider is not configured on this deployment";
		default:
			return null;
	}
}
