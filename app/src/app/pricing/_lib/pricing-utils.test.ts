import { describe, expect, it } from "vitest";
import {
	fmtPrice,
	prettyName,
	toPricedModel,
	type PricedModel,
} from "./pricing-utils";
import type { Model } from "@/lib/models-data";

const model: Model = {
	id: "demo-model",
	name: "Demo Model",
	provider: "Venice",
	tier: "premium",
	modality: "chat",
	description: "A demo model.",
	contextLength: "128K",
	contextTokens: 128_000,
	inputPricePer1M: 1.25,
	outputPricePer1M: 5,
	capabilities: ["chat"],
	modelId: "demo-model",
};

describe("pricing-utils", () => {
	it("maps a catalog model to the pricing table shape", () => {
		const priced: PricedModel = toPricedModel(model);

		expect(priced).toEqual({
			id: "demo-model",
			name: "Demo Model",
			category: "premium",
			provider: "Venice",
			inputPer1M: 1.25,
			outputPer1M: 5,
			ctx: "128K",
		});
	});

	it("formats prices across the displayed precision tiers", () => {
		expect(fmtPrice(0)).toBe("$0.01");
		expect(fmtPrice(0.1234)).toBe("$0.1234");
		expect(fmtPrice(1.25)).toBe("$1.25");
		expect(fmtPrice(12.5)).toBe("$12.50");
	});

	it("humanizes hyphenated model ids while preserving numeric tokens", () => {
		expect(prettyName("qwen3-235b-a22b-instruct-2507")).toBe(
			"Qwen3 235b A22b Instruct 2507",
		);
	});
});
