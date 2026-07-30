import { describe, it, expect } from "vitest";
import {
	FREE_CHAT_MODEL_IDS,
	FREE_DEFAULT_CHAT_MODEL,
	isFreeChatModel,
} from "@/lib/model-utils";

describe("isFreeChatModel (guest website chat)", () => {
	it("defaults free chat to minimax-m2.7", () => {
		expect(FREE_DEFAULT_CHAT_MODEL).toBe("minimax-m2.7");
		expect(FREE_CHAT_MODEL_IDS.has(FREE_DEFAULT_CHAT_MODEL)).toBe(true);
	});

	it("allows known free OMA-AI model ids without provider hint", () => {
		expect(isFreeChatModel("minimax-m2.7")).toBe(true);
		expect(isFreeChatModel("kimi-k2.6")).toBe(true);
	});

	it("allows OMA-AI provider even for unknown ids", () => {
		expect(isFreeChatModel("some-new-gonka-model", "OMA-AI")).toBe(true);
		expect(isFreeChatModel("some-new-gonka-model", "gonka")).toBe(true);
		expect(isFreeChatModel("some-new-gonka-model", "openbroker")).toBe(true);
	});

	it("requires auth for Venice / paid models", () => {
		expect(isFreeChatModel("llama-3.2-3b")).toBe(false);
		expect(isFreeChatModel("llama-3.2-3b", "Venice")).toBe(false);
		expect(isFreeChatModel("llama-3.2-3b", "venice")).toBe(false);
	});
});
