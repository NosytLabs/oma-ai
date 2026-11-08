/**
 * Client mirror of the server's model metadata vocabularies.
 *
 * The server owns `server/src/inference/model-metadata.ts`; this file mirrors
 * it because the two packages cannot share a type. The contract guard
 * (`scripts/check-state-contract.mjs`) fails when the two drift apart.
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
const MODEL_METADATA_VERIFICATION_STATUSES: readonly ModelMetadataVerification[] = [
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
const MODEL_PRIVACY_VALUES: readonly ModelPrivacy[] = [
	MODEL_PRIVACY.Private,
	MODEL_PRIVACY.Anonymized,
	MODEL_PRIVACY.Unverified,
];

/**
 * Parse a metadata verification status.
 *
 * Returns `null` for a value the vocabulary does not contain. `null` means
 * "unknown" and must be shown as such -- it never falls back to `verified`.
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

/**
 * The label for a metadata verification status.
 *
 * An unknown status reads "Unknown" -- never "Verified".
 */
export function modelMetadataVerificationLabel(
	status: ModelMetadataVerification | null | undefined,
): string {
	if (status === MODEL_METADATA_VERIFICATION.Verified) return "Verified";
	if (status === MODEL_METADATA_VERIFICATION.Unverified) return "Unverified";
	return "Unknown";
}

/** How a metadata verification status should be tinted. */
type ModelMetadataVerificationTone = "success" | "warning" | "muted";

/** The tone for a metadata verification status. Unknown is muted, not green. */
export function modelMetadataVerificationTone(
	status: ModelMetadataVerification | null | undefined,
): ModelMetadataVerificationTone {
	if (status === MODEL_METADATA_VERIFICATION.Verified) return "success";
	if (status === MODEL_METADATA_VERIFICATION.Unverified) return "warning";
	return "muted";
}
