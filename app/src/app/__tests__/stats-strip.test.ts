import { describe, expect, it } from "vitest";
import { countLiveModels } from "../_components/home/stats-strip";

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
