import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * GET /v1/models already tells the truth about availability: an entry is
 * `available: false` when its upstream key is missing or a placeholder
 * (server/src/inference/models.ts `providerAvailable()`).
 *
 * Regression: `ApiModelEntry` had no `available` field, so `loadModels()`
 * dropped the signal. Every surface then advertised all 20 models as
 * callable with no badge, no dimming and no disabled state — verified live
 * on /models: 20 cards, 0 flagged, 0 dimmed, while production reported 18
 * of 20 unavailable. A visitor could pick a model and get a 503.
 */
function apiPayload(entries: Array<Record<string, unknown>>) {
	return {
		object: "list",
		data: entries.map((e) => ({
			id: "claude-opus-5",
			display_name: "Claude Opus 5",
			owned_by: "venice",
			modality: "chat",
			pricing: { prompt: "7.5", completion: "30" },
			category: "frontier",
			context_length: 1_000_000,
			...e,
		})),
	};
}

describe("loadModels carries upstream availability", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("marks a model unavailable when the API reports available:false", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => apiPayload([{ id: "claude-opus-5", available: false }]),
			}),
		);

		const { loadModels } = await import("@/lib/models-data");
		const models = await loadModels();

		expect(models[0]?.available).toBe(false);
	});

	it("treats a missing available flag as available", async () => {
		// Back-compat: older/cached payloads and the static fallback catalog
		// omit the key. Omission must never hide a working model.
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => apiPayload([{ id: "claude-opus-5" }]),
			}),
		);

		const { loadModels } = await import("@/lib/models-data");
		const models = await loadModels();

		expect(models[0]?.available).toBe(true);
	});
});
