/**
 * Contract for the model metadata vocabularies.
 *
 * These statuses decide whether a model's advertised limits are presented as
 * a provider guarantee or as OMA configuration, so an unknown value must
 * never be treated as "verified".
 */
import { describe, expect, it } from "vitest";
import {
	MODEL_METADATA_VERIFICATION,
	MODEL_METADATA_VERIFICATION_STATUSES,
	MODEL_PRIVACY,
	MODEL_PRIVACY_VALUES,
	parseModelMetadataVerification,
	parseModelPrivacy,
} from "../model-metadata.js";

describe("MODEL_METADATA_VERIFICATION", () => {
	it("keeps the wire values", () => {
		expect(MODEL_METADATA_VERIFICATION.Verified).toBe("verified");
		expect(MODEL_METADATA_VERIFICATION.Unverified).toBe("unverified");
	});

	it("exposes exactly the two statuses the API can return", () => {
		expect([...MODEL_METADATA_VERIFICATION_STATUSES].sort()).toEqual([
			"unverified",
			"verified",
		]);
	});
});

describe("parseModelMetadataVerification", () => {
	it("parses the known statuses", () => {
		expect(parseModelMetadataVerification("verified")).toBe(
			MODEL_METADATA_VERIFICATION.Verified,
		);
		expect(parseModelMetadataVerification("unverified")).toBe(
			MODEL_METADATA_VERIFICATION.Unverified,
		);
	});

	it("returns null for anything else", () => {
		expect(parseModelMetadataVerification("Verified")).toBeNull();
		expect(parseModelMetadataVerification("pending")).toBeNull();
		expect(parseModelMetadataVerification("")).toBeNull();
		expect(parseModelMetadataVerification(undefined)).toBeNull();
		expect(parseModelMetadataVerification(null)).toBeNull();
		expect(parseModelMetadataVerification(1)).toBeNull();
	});
});

describe("MODEL_PRIVACY", () => {
	it("keeps the wire values", () => {
		expect(MODEL_PRIVACY.Private).toBe("private");
		expect(MODEL_PRIVACY.Anonymized).toBe("anonymized");
		expect(MODEL_PRIVACY.Unverified).toBe("unverified");
		expect([...MODEL_PRIVACY_VALUES].sort()).toEqual([
			"anonymized",
			"private",
			"unverified",
		]);
	});
});

describe("parseModelPrivacy", () => {
	it("parses the known values", () => {
		expect(parseModelPrivacy("private")).toBe(MODEL_PRIVACY.Private);
		expect(parseModelPrivacy("anonymized")).toBe(MODEL_PRIVACY.Anonymized);
		expect(parseModelPrivacy("unverified")).toBe(MODEL_PRIVACY.Unverified);
	});

	it("returns null for anything else", () => {
		expect(parseModelPrivacy("anonymous")).toBeNull();
		expect(parseModelPrivacy(undefined)).toBeNull();
		expect(parseModelPrivacy(null)).toBeNull();
	});
});
