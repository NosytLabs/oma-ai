import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const LIVE: {
	object: string;
	data: Array<Record<string, unknown>>;
} = {
	object: "list",
	data: [
		{
			id: "gpt-x",
			display_name: "GPT-X",
			category: "frontier",
			pricing: { prompt: "1.5", completion: "6" },
			context_length: 128000,
		},
		{
			id: "video-maker",
			display_name: "Video Maker",
			category: "video",
			pricing: { prompt: "", completion: null, generation: "0.1" },
			context_length: 0,
			duration: "10s",
		},
	],
};

describe("models-data caching", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("loadRawModelEntries returns the unfiltered list (incl. video)", async () => {
		vi.spyOn(global, "fetch").mockResolvedValue(
			new Response(JSON.stringify(LIVE), { status: 200 }),
		);
		const { loadRawModelEntries } = await import("./models-data");
		const entries = await loadRawModelEntries();
		expect(entries).toHaveLength(2);
	});

	it("loadModels and loadRawModelEntries share a single network request", async () => {
		const fetchSpy = vi
			.spyOn(global, "fetch")
			.mockResolvedValue(new Response(JSON.stringify(LIVE), { status: 200 }));
		const { loadModels, loadRawModelEntries } = await import("./models-data");

		const [models, entries] = await Promise.all([
			loadModels(),
			loadRawModelEntries(),
		]);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(models).toHaveLength(1);
		expect(models[0]?.id).toBe("gpt-x");
		expect(entries).toHaveLength(2);
	});

	it("falls back to the static catalog when the API fails", async () => {
		vi.spyOn(global, "fetch").mockRejectedValue(new Error("backend down"));
		const { loadModels } = await import("./models-data");
		const models = await loadModels();
		expect(models.length).toBeGreaterThan(0);
	});
});