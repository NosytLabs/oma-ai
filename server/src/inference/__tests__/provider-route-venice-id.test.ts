import { describe, expect, it, vi } from "vitest";
import { resolveProvider } from "../provider-route.js";
import type { ModelDef } from "../models.js";

vi.mock("../../config.js", () => ({
	config: {
		VENICE_API_KEY: "venice-test-key-not-a-placeholder",
		VENICE_API_URL: "https://api.venice.ai",
		OMMA_ALLOW_NON_PRIVATE_VENICE: false,
		SURPLUS_API_KEY: "surplus-test-key",
		SURPLUS_API_URL: "https://api.surplusintelligence.ai",
	},
}));

function veniceModel(overrides: Partial<ModelDef> = {}): ModelDef {
	return {
		id: "public-model-id",
		provider: "venice",
		inputPricePer1M: 1,
		outputPricePer1M: 2,
		markupPercent: 25,
		displayName: "Public Model",
		category: "mid",
		maxTokens: 1024,
		supportsStreaming: true,
		capabilities: ["chat"],
		...overrides,
	};
}

describe("venice upstream model id", () => {
	/**
	 * Regression: `veniceId` was declared on ModelDef but never read, so a
	 * catalog entry whose PUBLIC id differs from its Venice id sent the
	 * public id upstream and 404'd. `mistral-small-2603` is that entry —
	 * Venice's live catalog has no such model, only
	 * `mistral-small-3-2-24b-instruct`. The public id must stay stable for
	 * for API consumers, so the override has to be honored on the Venice route.
	 */
	it("sends veniceId upstream when the catalog defines one", () => {
		const route = resolveProvider(
			"venice",
			veniceModel({ id: "mistral-small-2603", veniceId: "mistral-small-3-2-24b-instruct" }),
		);
		expect(route.upstreamModel("mistral-small-2603")).toBe(
			"mistral-small-3-2-24b-instruct",
		);
	});

	it("falls back to the public id when no veniceId is set", () => {
		const route = resolveProvider("venice", veniceModel({ id: "claude-opus-5" }));
		expect(route.upstreamModel("claude-opus-5")).toBe("claude-opus-5");
	});

	it("falls back to the public id when no model definition is supplied", () => {
		const route = resolveProvider("venice");
		expect(route.upstreamModel("kimi-k3")).toBe("kimi-k3");
	});
});
