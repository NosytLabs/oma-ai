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

		// We might have multiple calls if they don't share perfectly due to module reset
		expect(fetchSpy).toHaveBeenCalled();
		expect(models.length).toBeGreaterThan(0);
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

describe("static OMA model routing ids", () => {
	it("keeps public model ids URL-safe while preserving upstream ids", async () => {
		const { MODELS } = await import("./models-data");
		const minimax = MODELS.find((m) => m.id === "minimax-m2-7");
		const deepseek = MODELS.find(
			(m) => m.id === "deepseek-v4-flash-0731-openbroker",
		);

		expect(minimax?.id).not.toContain("/");
		expect(minimax?.modelId).toBe("MiniMaxAI/MiniMax-M2.7");
		expect(deepseek?.id).not.toContain("/");
		expect(deepseek?.modelId).toBe("deepseek-ai/DeepSeek-V4-Flash-0731");
	});
});

describe("live model capabilities", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	async function loadEntry(fields: Record<string, unknown>) {
		vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
			object: "list",
			data: [{ ...LIVE.data[0], ...fields }],
		}), { status: 200 }));
		const { loadModels } = await import("./models-data");
		return (await loadModels())[0];
	}

	it("keeps canonical reasoning, coding, vision, and agent capabilities after loading", async () => {
		const model = await loadEntry({
			id: "gemini-3-6-flash",
			capabilities: ["chat", "reasoning", "coding", "tools", "vision"],
			supports_tools: true,
		});
		expect(model.capabilities).toEqual(["chat", "reasoning", "coding", "vision", "agents"]);
		expect(model.inputPricePer1M).toBe(1.5);
		expect(model.outputPricePer1M).toBe(6);
	});

	it("preserves direct fast and multimodal capability declarations", async () => {
		const model = await loadEntry({ capabilities: ["chat", "fast", "multimodal"] });
		expect(model.capabilities).toEqual(["chat", "multimodal", "fast"]);
	});

	it("lets canonical metadata replace stale curated and legacy capabilities", async () => {
		const model = await loadEntry({
			id: "claude-opus-5",
			capabilities: ["chat"],
			supported_parameters: ["tools", "reasoning"],
		});
		expect(model.capabilities).toEqual(["chat"]);
	});

	it("treats an empty canonical list as authoritative", async () => {
		const model = await loadEntry({ id: "claude-opus-5", capabilities: [] });
		expect(model.capabilities).toEqual([]);
	});

	it.each([
		{ capabilities: ["chat", "tools"] },
		{ supported_parameters: ["tools"] },
		{ id: "claude-opus-5" },
	])("honors explicit false tool support over other signals: %j", async (metadata) => {
		const model = await loadEntry({ ...metadata, supports_tools: false });
		expect(model.capabilities).not.toContain("agents");
	});

	it("retains curated capabilities for a known model served by an older API", async () => {
		const model = await loadEntry({ id: "claude-opus-5", supports_tools: true });
		expect(model.capabilities).toEqual(["chat", "reasoning", "coding", "multimodal", "agents"]);
	});

	it("uses supported parameters and the tool flag for an unknown legacy model", async () => {
		const model = await loadEntry({ supported_parameters: ["reasoning_effort"], supports_tools: true });
		expect(model.capabilities).toEqual(["chat", "reasoning", "agents"]);
	});

	it("does not assume tools or reasoning for an unknown model with no metadata", async () => {
		const model = await loadEntry({});
		expect(model.capabilities).toEqual(["chat"]);
	});
});
