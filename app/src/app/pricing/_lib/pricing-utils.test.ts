import { describe, expect, it } from "vitest";
import { fmtPrice, toPricedModel, type PricedModel } from "./pricing-utils";
import { formatPricePerMillion, type Model } from "@/lib/models-data";

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
			contextTokens: 128000,
		});
	});

	it("formats prices across the displayed precision tiers", () => {
		expect(fmtPrice(0)).toBe("Free");
		expect(fmtPrice(0.0125)).toBe("$0.0125");
		expect(fmtPrice(0.1234)).toBe("$0.1234");
		expect(fmtPrice(1.25)).toBe("$1.25");
		expect(fmtPrice(12.5)).toBe("$12.50");
	});

	it("preserves fractional catalog rates consistently across pricing and models", () => {
		for (const [rate, expected] of [[0.6125, "$0.6125"], [0.21875, "$0.21875"], [7.8125, "$7.8125"], [0.000123, "$0.000123"]] as const) {
			expect(fmtPrice(rate)).toBe(expected);
			expect(formatPricePerMillion(rate)).toBe(expected);
		}
		expect(fmtPrice(0.18)).toBe("$0.18");
		expect(formatPricePerMillion(Number.NaN)).toBe("—");
	});
});
