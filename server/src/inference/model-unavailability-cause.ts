/**
 * Why a model cannot be called right now.
 *
 * The API used to collapse four different causes into one boolean: an
 * operator paused the model, the deployment policy blocks the provider
 * route, the provider credential is missing or a placeholder, or the catalog
 * names a provider the server does not know. A client that only sees
 * `available: false` cannot tell "temporarily paused" from "this deployment
 * has no credential", so it can only show a generic notice.
 *
 * Deliberately dependency-free: the OpenAPI spec and the app mirror both
 * read these values, and neither may pull the deployment config (and its
 * environment requirements) into its own build.
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
export const MODEL_UNAVAILABILITY_CAUSES: readonly ModelUnavailabilityCause[] = [
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
