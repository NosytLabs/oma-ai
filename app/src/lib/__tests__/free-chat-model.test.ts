import { describe, it, expect } from "vitest";
import {
	FREE_CHAT_MODEL_IDS,
	FREE_DEFAULT_CHAT_MODEL,
	FREE_TIER_LABELS,
	DOCS_EXAMPLE_MODEL,
	isFreeChatModel,
} from "@/lib/model-utils";
import { MODELS } from "@/lib/models-data";

describe("isFreeChatModel (guest website chat)", () => {
	it("defaults free chat to an allowlisted catalog id", () => {
		expect(FREE_DEFAULT_CHAT_MODEL).toBe("minimax-m2-7");
		expect(FREE_CHAT_MODEL_IDS.has(FREE_DEFAULT_CHAT_MODEL)).toBe(true);
		const catalogIds = new Set(MODELS.map(model => model.id));
		for (const id of FREE_CHAT_MODEL_IDS) expect(catalogIds.has(id)).toBe(true);
	});

	it("only OMA-AI / Gonka.AI upstream models are free; everything else requires auth", () => {
		expect(isFreeChatModel("deepseek-v4-flash-0731-openbroker")).toBe(true);
		expect(isFreeChatModel("kimi-k2-6")).toBe(false);
		expect(isFreeChatModel("minimax-m2-7")).toBe(true);

		expect(isFreeChatModel("kimi-k3")).toBe(false);
		expect(isFreeChatModel("llama-3.3-70b")).toBe(false);
		expect(isFreeChatModel("llama-3.3-70b", "Venice")).toBe(false);
	});

	it("only allowlisted openbroker ids are free; unknown ids require auth", () => {
		expect(isFreeChatModel("some-new-oma-ai-model", "OMA-AI")).toBe(false);
		expect(isFreeChatModel("some-gonka-model")).toBe(false); // not yet allowlisted
	});

	it("exports a docs example model that is not free", () => {
		expect(DOCS_EXAMPLE_MODEL).toBe("llama-3.3-70b");
		expect(isFreeChatModel(DOCS_EXAMPLE_MODEL)).toBe(false);
	});
});

describe("FREE_TIER_LABELS", () => {
	it("covers every entry in FREE_CHAT_MODEL_IDS", () => {
		for (const id of FREE_CHAT_MODEL_IDS) {
			expect(FREE_TIER_LABELS[id], `missing label for ${id}`).toBeDefined();
			expect(FREE_TIER_LABELS[id].label.length).toBeGreaterThan(0);
			expect(FREE_TIER_LABELS[id].tooltip.length).toBeGreaterThan(0);
		}
	});

	it("the default model has a free label", () => {
		expect(FREE_TIER_LABELS[FREE_DEFAULT_CHAT_MODEL]).toBeDefined();
		// Its label is the plain "Free" — primary OMA-AI / Gonka.AI tier.
		expect(FREE_TIER_LABELS[FREE_DEFAULT_CHAT_MODEL].label).toBe("Free");
	});
});
