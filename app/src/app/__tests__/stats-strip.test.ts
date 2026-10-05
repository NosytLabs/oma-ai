import { describe, expect, it } from "vitest";
// Imported from the shared hook module (the canonical home) rather than via
// stats-strip's re-export, so this test tracks the single implementation the
// hero and the strip both consume.
import { countLiveModels } from "../_components/home/use-live-count";
import {
	formatPricePerMillion,
	MIN_INPUT_PRICE,
	MIN_INPUT_PRICE_LABEL,
	MODELS,
} from "@/lib/models-data";

describe("homepage live model count", () => {
	it("excludes unavailable entries", () => {
		const entries = [
			{ modality: "chat", available: true },
			{ modality: "chat", available: false },
			{ modality: "chat", available: false },
		];
		expect(countLiveModels(entries)).toBe(1);
	});

	it("counts entries that omit the availability flag", () => {
		// The flag is optional on the wire; an absent flag must not be read as
		// unavailable, or a catalog that stops sending it would show zero.
		expect(countLiveModels([{ modality: "chat" }, { modality: "chat" }])).toBe(2);
	});

	it("still filters non-chat modalities", () => {
		const entries = [
			{ modality: "chat", available: true },
			{ modality: "image", available: true },
			{ modality: "video", available: true },
		];
		expect(countLiveModels(entries)).toBe(1);
	});

	it("falls back to category when modality is missing", () => {
		const entries = [
			{ category: "frontier", available: true },
			{ category: "budget", available: true },
			{ category: "embedding", available: true },
		];
		expect(countLiveModels(entries)).toBe(2);
	});

	it("returns zero when every entry is unavailable", () => {
		expect(countLiveModels([{ modality: "chat", available: false }])).toBe(0);
	});
});

describe("shared minimum price anchor", () => {
	it("derives the anchor from the catalog instead of hardcoding it", () => {
		// The hero, stats strip, and capabilities grid all render this one
		// value. If it ever diverges from the catalog's cheapest input rate,
		// the marketing claim and the real price list disagree again.
		const cheapest = Math.min(
			...MODELS.map((m) => m.inputPricePer1M).filter((p) => p > 0),
		);
		expect(MIN_INPUT_PRICE).toBe(cheapest);
	});

	it("pre-formats the anchor with the shared price formatter", () => {
		expect(MIN_INPUT_PRICE_LABEL).toBe(formatPricePerMillion(MIN_INPUT_PRICE));
	});

	it("renders a positive dollar figure", () => {
		expect(MIN_INPUT_PRICE).toBeGreaterThan(0);
		expect(MIN_INPUT_PRICE_LABEL).toMatch(/^\$\d/);
	});
});
