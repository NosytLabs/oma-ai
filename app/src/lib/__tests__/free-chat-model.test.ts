import { describe, it, expect } from "vitest";
import {
	FREE_CHAT_MODEL_IDS,
	FREE_DEFAULT_CHAT_MODEL,
	DOCS_EXAMPLE_MODEL,
	isFreeChatModel,
} from "@/lib/model-utils";

describe("isFreeChatModel (guest website chat)", () => {
	it("defaults free chat to an allowlisted catalog id", () => {
		expect(FREE_DEFAULT_CHAT_MODEL).toBe("gemini-3-flash-preview");
		expect(FREE_CHAT_MODEL_IDS.has(FREE_DEFAULT_CHAT_MODEL)).toBe(true);
	});

	it("only gonka-network openbroker models are free; everything else requires auth", () => {
		// Free — every model with server-side upstream === "openbroker"
		// (api.openbroker.gonka.gg). See server/src/inference/models.ts.
		expect(isFreeChatModel("deepseek-v4-flash-0731-openbroker")).toBe(true);
		expect(isFreeChatModel("gemini-3-flash-preview")).toBe(true);
		expect(isFreeChatModel("kimi-k2-6")).toBe(true);
		expect(isFreeChatModel("minimax-m2-7")).toBe(true);
		expect(isFreeChatModel("mistral-small-2603")).toBe(true);

		// Paid — Venice-routed models always require auth. (Pre-2026-08-17
		// this block also covered OMA-AI resale through Zyloo, e.g.
		// qwen3-235b-a22b-openbroker, gpt-4o, gemini-3.1-pro-preview.
		// Those models were deleted along with Zyloo.)
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
