import { describe, it, expect } from "vitest";
import {
	FREE_CHAT_MODEL_IDS,
	FREE_DEFAULT_CHAT_MODEL,
	FREE_TIER_LABELS,
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

/**
 * Open question 1 (audit 2026-09-01-userflow.md §5): the model picker
 * should show a DEFAULT badge on the FREE_DEFAULT_CHAT_MODEL row.
 * Locked in by exporting FREE_DEFAULT_CHAT_MODEL and having the
 * ModelSelector render the badge for `model.id === FREE_DEFAULT_CHAT_MODEL`.
 *
 * Open question 2 (audit 2026-09-01 §5): the mistral "free" badge
 * could be misread as "OpenBroker-grade free" when it's a Venice
 * fallback. FREE_TIER_LABELS disambiguates the two tiers with
 * explicit copy + tooltip.
 */
describe("FREE_TIER_LABELS (audit 2026-09-01-userflow.md §5)", () => {
	it("covers every entry in FREE_CHAT_MODEL_IDS", () => {
		for (const id of FREE_CHAT_MODEL_IDS) {
			expect(FREE_TIER_LABELS[id], `missing label for ${id}`).toBeDefined();
			expect(FREE_TIER_LABELS[id].label.length).toBeGreaterThan(0);
			expect(FREE_TIER_LABELS[id].tooltip.length).toBeGreaterThan(0);
		}
	});

	it("the Venice fallback (mistral-small-2603) gets an asterisk to flag its nature", () => {
		expect(FREE_TIER_LABELS["mistral-small-2603"].label).toBe("Free*");
		// The tooltip must explicitly call out that this is a Venice fallback
		// so a hovering user knows it's not the same as the OpenBroker tier.
		expect(FREE_TIER_LABELS["mistral-small-2603"].tooltip.toLowerCase()).toContain(
			"venice",
		);
	});

	it("the default model (gemini-3-flash-preview) is in the labels map", () => {
		expect(FREE_TIER_LABELS[FREE_DEFAULT_CHAT_MODEL]).toBeDefined();
		// Its label is the plain "Free" (no asterisk) — primary free tier.
		expect(FREE_TIER_LABELS[FREE_DEFAULT_CHAT_MODEL].label).toBe("Free");
	});
});
