import { describe, it, expect } from "vitest";
import {
	FREE_CHAT_MODEL_IDS,
	FREE_DEFAULT_CHAT_MODEL,
	DOCS_EXAMPLE_MODEL,
	isFreeChatModel,
} from "@/lib/model-utils";

describe("isFreeChatModel (guest website chat)", () => {
	it("defaults free chat to a gonka catalog id", () => {
		expect(FREE_DEFAULT_CHAT_MODEL).toBe("gemini-3-flash-preview");
		expect(FREE_CHAT_MODEL_IDS.has(FREE_DEFAULT_CHAT_MODEL)).toBe(true);
	});

	it("allows known free OMA-AI model ids without provider hint", () => {
		expect(isFreeChatModel("gemini-3-flash-preview")).toBe(true);
		expect(isFreeChatModel("gpt-4o")).toBe(true);
		expect(isFreeChatModel("kimi-k3")).toBe(false); // Venice-routed on the server — requires auth
		expect(isFreeChatModel("glm-5.2-fp8")).toBe(false); // removed from OpenBroker
	});

	it("allows OMA-AI provider even for unknown ids", () => {
		expect(isFreeChatModel("some-new-oma-ai-model", "OMA-AI")).toBe(true);
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
