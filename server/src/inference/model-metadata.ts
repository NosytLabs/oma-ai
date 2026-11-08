/**
 * Model metadata vocabularies.
 *
 * A model carries two metadata states that were bare strings: whether the
 * provider's advertised limits were verified against its own catalog, and the
 * privacy of the provider route behind the model.
 *
 * Both were typed `string` on the server and mirrored as `string` in the app,
 * and the only formal definition of the values was a hand-written OpenAPI
 * enum -- so the compiler could not catch a typo in the catalog, and the
 * client could not tell "unverified" from "some value nobody has seen".
 *
 * The server owns these vocabularies. The app mirrors them
 * (`app/src/lib/api/model-metadata.ts`) and `scripts/check-state-contract.mjs`
 * fails when the two sides disagree.
 */

/**
 * Whether the provider's advertised limits were checked against the
 * provider's catalog.
 *
 * `Unverified` means "OMA configuration, not confirmed upstream" -- it is not
 * a statement that the limits are wrong.
 */
export const MODEL_METADATA_VERIFICATION = {
	/** The advertised limits were checked against the provider's catalog. */
	Verified: "verified",
	/** The limits are OMA's configuration; the provider has not confirmed them. */
	Unverified: "unverified",
} as const;

export type ModelMetadataVerification =
	(typeof MODEL_METADATA_VERIFICATION)[keyof typeof MODEL_METADATA_VERIFICATION];

/** Every metadata verification status, in wire order. */
export const MODEL_METADATA_VERIFICATION_STATUSES: readonly ModelMetadataVerification[] = [
	MODEL_METADATA_VERIFICATION.Verified,
	MODEL_METADATA_VERIFICATION.Unverified,
];

/** The privacy of the provider route behind a model. */
export const MODEL_PRIVACY = {
	/** The provider receives the request as sent. */
	Private: "private",
	/** The provider receives a de-identified request. */
	Anonymized: "anonymized",
	/** The route's privacy could not be confirmed. */
	Unverified: "unverified",
} as const;

export type ModelPrivacy = (typeof MODEL_PRIVACY)[keyof typeof MODEL_PRIVACY];

/** Every privacy value, in wire order. */
export const MODEL_PRIVACY_VALUES: readonly ModelPrivacy[] = [
	MODEL_PRIVACY.Private,
	MODEL_PRIVACY.Anonymized,
	MODEL_PRIVACY.Unverified,
];

/**
 * Parse a metadata verification status.
 *
 * Returns `null` for anything the vocabulary does not contain -- the caller
 * then decides how to present an unknown state. It never silently becomes
 * `verified`.
 */
export function parseModelMetadataVerification(
	raw: unknown,
): ModelMetadataVerification | null {
	return (MODEL_METADATA_VERIFICATION_STATUSES as readonly unknown[]).includes(raw)
		? (raw as ModelMetadataVerification)
		: null;
}

/** Parse a provider route privacy value. Returns `null` for unknown values. */
export function parseModelPrivacy(raw: unknown): ModelPrivacy | null {
	return (MODEL_PRIVACY_VALUES as readonly unknown[]).includes(raw)
		? (raw as ModelPrivacy)
		: null;
}
