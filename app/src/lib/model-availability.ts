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

export interface AvailabilityFlag {
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
