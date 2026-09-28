import { describe, expect, it } from "vitest";
import { MODELS } from "@/lib/models-data";
import { withLiveModelDetails } from "../_lib/detail-data";

const model = MODELS[0];

describe("model detail data", () => {
	it("preserves valid numeric and string prices in per-million units", () => {
		const result = withLiveModelDetails(model, { id: model.id, pricing: { prompt: "0.21875", completion: 0 }, context_length: 128000 });
		expect(result).toMatchObject({ inputPricePer1M: 0.21875, outputPricePer1M: 0, contextTokens: 128000, contextLength: "128K" });
	});

	it("keeps curated facts when a live value is missing or malformed", () => {
		const result = withLiveModelDetails(model, { id: model.id, pricing: { prompt: -1, completion: "unknown" }, context_length: 0 });
		expect(result).toMatchObject({ inputPricePer1M: model.inputPricePer1M, outputPricePer1M: model.outputPricePer1M, contextTokens: model.contextTokens });
		expect(withLiveModelDetails(model, null)).toBe(model);
	});
});
