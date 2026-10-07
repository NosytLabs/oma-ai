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

	it("replaces curated capabilities with the live catalog", () => {
		const result = withLiveModelDetails(model, { id: model.id, capabilities: ["chat", "vision"] });
		expect(result.capabilities).toEqual(["chat", "vision"]);
		expect(result.description).toBe(model.description);
	});

	it("retains curated capabilities when an older API has no full list", () => {
		const result = withLiveModelDetails(model, { id: model.id, supports_tools: true });
		expect(result.capabilities).toEqual(model.capabilities);
	});

	it("honors an explicit false tool flag without losing other curated facts", () => {
		const result = withLiveModelDetails(model, { id: model.id, supports_tools: false, supported_parameters: ["tools"] });
		expect(result.capabilities).toEqual(model.capabilities.filter((capability) => capability !== "agents"));
	});

	it("does not repopulate an explicit empty capability list from the fallback", () => {
		const result = withLiveModelDetails(model, { id: model.id, capabilities: [] });
		expect(result.capabilities).toEqual([]);
	});
});
