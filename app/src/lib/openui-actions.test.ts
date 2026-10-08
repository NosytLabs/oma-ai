import { describe, expect, it } from "vitest";
import { normalizeOpenUIAction } from "./openui-actions";

describe("normalizeOpenUIAction", () => {
	it("accepts an allowed follow-up action", () => {
		expect(
			normalizeOpenUIAction({
				type: "followup",
				params: { prompt: "Compare the two cheapest models" },
			}),
		).toEqual({
			type: "followup",
			prompt: "Compare the two cheapest models",
		});
	});

	it("reads validated settings from OpenUI form state", () => {
		expect(
			normalizeOpenUIAction({
				type: "apply-settings",
				params: {},
				formState: {
					"oma-settings": {
						model: { value: "deepseek-v4-flash-0731-openbroker" },
						temperature: { value: 0.4 },
						topP: { value: 0.9 },
						maxTokens: { value: 4096 },
					},
				},
			}),
		).toEqual({
			type: "apply-settings",
			settings: {
				model: "deepseek-v4-flash-0731-openbroker",
				temperature: 0.4,
				topP: 0.9,
				maxTokens: 4096,
			},
		});
	});

	it("rejects unknown actions and out-of-range settings", () => {
		expect(normalizeOpenUIAction({ type: "delete-account" })).toBeNull();
		expect(
			normalizeOpenUIAction({
				type: "apply-settings",
				formState: {
					"oma-settings": {
						temperature: { value: 8 },
						topP: { value: -1 },
						maxTokens: { value: 0 },
					},
				},
			}),
		).toBeNull();
		expect(
			normalizeOpenUIAction({
				type: "apply-settings",
				params: { maxTokens: 32_001 },
			}),
		).toBeNull();
	});
});
