/**
 * Contract for the client mirror of the model metadata vocabularies.
 *
 * The label and tone are what a visitor actually reads, and the rule that
 * matters most: an unknown status reads "Unknown" and is muted -- it never
 * reads or looks like "Verified".
 */
import { describe, expect, it } from "vitest";
import {
	MODEL_METADATA_VERIFICATION,
	MODEL_PRIVACY,
	modelMetadataVerificationLabel,
	modelMetadataVerificationTone,
	parseModelMetadataVerification,
	parseModelPrivacy,
} from "../model-metadata";

describe("parseModelMetadataVerification", () => {
	it("parses the known statuses", () => {
		expect(parseModelMetadataVerification("verified")).toBe(
			MODEL_METADATA_VERIFICATION.Verified,
		);
		expect(parseModelMetadataVerification("unverified")).toBe(
			MODEL_METADATA_VERIFICATION.Unverified,
		);
	});

	it("returns null for an unknown status", () => {
		expect(parseModelMetadataVerification("pending")).toBeNull();
		expect(parseModelMetadataVerification(undefined)).toBeNull();
		expect(parseModelMetadataVerification(null)).toBeNull();
	});
});

describe("modelMetadataVerificationLabel", () => {
	it("labels the known statuses", () => {
		expect(modelMetadataVerificationLabel(MODEL_METADATA_VERIFICATION.Verified)).toBe(
			"Verified",
		);
		expect(
			modelMetadataVerificationLabel(MODEL_METADATA_VERIFICATION.Unverified),
		).toBe("Unverified");
	});

	it("labels an unknown status as Unknown, never as Verified", () => {
		expect(modelMetadataVerificationLabel(null)).toBe("Unknown");
		expect(modelMetadataVerificationLabel(undefined)).toBe("Unknown");
	});
});

describe("modelMetadataVerificationTone", () => {
	it("tones verified as success and unverified as a warning", () => {
		expect(
			modelMetadataVerificationTone(MODEL_METADATA_VERIFICATION.Verified),
		).toBe("success");
		expect(
			modelMetadataVerificationTone(MODEL_METADATA_VERIFICATION.Unverified),
		).toBe("warning");
	});

	it("tones an unknown status as muted, not as success", () => {
		expect(modelMetadataVerificationTone(null)).toBe("muted");
		expect(modelMetadataVerificationTone(undefined)).toBe("muted");
	});
});

describe("parseModelPrivacy", () => {
	it("parses the known values and rejects the rest", () => {
		expect(parseModelPrivacy("private")).toBe(MODEL_PRIVACY.Private);
		expect(parseModelPrivacy("anonymized")).toBe(MODEL_PRIVACY.Anonymized);
		expect(parseModelPrivacy("unverified")).toBe(MODEL_PRIVACY.Unverified);
		expect(parseModelPrivacy("anonymous")).toBeNull();
		expect(parseModelPrivacy(undefined)).toBeNull();
	});
});
