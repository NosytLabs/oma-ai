import { describe, it, expect } from "vitest";
import {
	FREE_CHAT_MODEL_IDS,
	FREE_DEFAULT_CHAT_MODEL,
	DOCS_EXAMPLE_MODEL,
	isFreeChatModel,
} from "@/lib/model-utils";

describe("isFreeChatModel (guest website chat)", () => {
	it("defaults free chat to a gonka catalog id", () => {
		expect(FREE_DEFAULT_CHAT_MODEL).toBe("minimax-m2.7");
		expect(FREE_CHAT_MODEL_IDS.has(FREE_DEFAULT_CHAT_MODEL)).toBe(true);
	});

	it("allows known free OMA-AI (gonka) model ids without provider hint", () => {
		expect(isFreeChatModel("minimax-m2.7")).toBe(true);
		expect(isFreeChatModel("kimi-k2.6")).toBe(true);
		expect(isFreeChatModel("glm-5.2-fp8")).toBe(false); // removed from OpenBroker
	});

	it("allows OMA-AI provider even for unknown ids", () => {
		expect(isFreeChatModel("some-new-gonka-model", "OMA-AI")).toBe(true);
		expect(isFreeChatModel("some-new-gonka-model", "gonka")).toBe(true);
		expect(isFreeChatModel("some-new-gonka-model", "openbroker")).toBe(true);
	});

	it("requires auth for Venice / paid models", () => {
		expect(isFreeChatModel("llama-3.3-70b")).toBe(false);
		expect(isFreeChatModel("llama-3.3-70b", "Venice")).toBe(false);
		expect(isFreeChatModel("deepseek-v4-flash", "venice")).toBe(false);
	});

	it("exports a docs example model that is not free", () => {
		expect(DOCS_EXAMPLE_MODEL).toBe("llama-3.3-70b");
		expect(isFreeChatModel(DOCS_EXAMPLE_MODEL)).toBe(false);
	});
});
