import { describe, expect, it } from "vitest";
import { modelAvailability } from "../model-availability.js";
import {
	MODEL_UNAVAILABILITY_CAUSE,
	MODEL_UNAVAILABILITY_CAUSES,
	parseModelUnavailabilityCause,
} from "../model-unavailability-cause.js";
import { listAllModels, type ModelDef } from "../models.js";

describe("MODEL_UNAVAILABILITY_CAUSE", () => {
	it("keeps the wire values", () => {
		expect(MODEL_UNAVAILABILITY_CAUSE.Disabled).toBe("disabled");
		expect(MODEL_UNAVAILABILITY_CAUSE.MissingCredential).toBe("missing_credential");
		expect(MODEL_UNAVAILABILITY_CAUSE.PolicyBlocked).toBe("policy_blocked");
		expect(MODEL_UNAVAILABILITY_CAUSE.UnknownProvider).toBe("unknown_provider");
		expect([...MODEL_UNAVAILABILITY_CAUSES].sort()).toEqual([
			"disabled",
			"missing_credential",
			"policy_blocked",
			"unknown_provider",
		]);
	});

	it("parses known causes and rejects the rest", () => {
		expect(parseModelUnavailabilityCause("disabled")).toBe(
			MODEL_UNAVAILABILITY_CAUSE.Disabled,
		);
		expect(parseModelUnavailabilityCause("paused")).toBeNull();
		expect(parseModelUnavailabilityCause(undefined)).toBeNull();
	});
});

describe("modelAvailability", () => {
	const base = {
		id: "test-model",
		provider: "acme",
		privacy: "private",
		inputPricePer1M: 0,
		outputPricePer1M: 0,
		markupPercent: 0,
		maxTokens: 100,
		displayName: "Test",
		category: "mid",
		supportsStreaming: true,
		capabilities: [],
	} satisfies ModelDef;

	it("names an operator pause and keeps the reason", () => {
		const availability = modelAvailability({ ...base, disabledReason: "Quality regression" });
		expect(availability.available).toBe(false);
		expect(availability.cause).toBe(MODEL_UNAVAILABILITY_CAUSE.Disabled);
		expect(availability.reason).toBe("Quality regression");
	});

	it("names an unknown provider", () => {
		const availability = modelAvailability(base);
		expect(availability.available).toBe(false);
		expect(availability.cause).toBe(MODEL_UNAVAILABILITY_CAUSE.UnknownProvider);
		expect(availability.reason).toBeUndefined();
	});

	it("always explains an unavailable model and never explains an available one", () => {
		for (const model of listAllModels()) {
			const availability = modelAvailability(model);
			if (availability.available) {
				expect(availability.cause).toBeUndefined();
			} else {
				expect(availability.cause).toBeDefined();
			}
		}
	});
});
