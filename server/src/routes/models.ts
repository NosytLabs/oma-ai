import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import {
		ensureCatalogLoaded,
		listAllModels,
		providerAvailable,
} from "../inference/models.js";
import { userFacingFor } from "../inference/billing-service.js";

export const modelRoutes = new Hono<OmaEnv>();

/**
	* User-facing per-1M prices for a model, via the same override-aware
	* lookup billing deducts with — displayed prices always match charges.
	*/
function facingPrices(m: { id: string }): { prompt: number; completion: number } {
		const pricing = userFacingFor(m.id);
		return { prompt: pricing.inputPer1M, completion: pricing.outputPer1M };
}

// OpenAI-compatible /v1/models
modelRoutes.get("/v1/models", async (c) => {
		await ensureCatalogLoaded();
		const models = listAllModels();
		return c.json({
				object: "list",
				data: models.map((m) => {
						// Prices are user-facing (markup applied) so dashboards, chat cost
						// pills, and billing all show the same number the customer is charged.
						const prices = facingPrices(m);
						return {
								id: m.id,
								object: "model",
								created: Math.floor(Date.now() / 1000),
								owned_by: m.provider ?? "oma",
								display_name: m.displayName,
								provider: m.provider,
								category: m.category,
								modality: "chat",
								context_length: m.contextWindow ?? 0,
								supports_streaming: m.supportsStreaming,
								supports_tools: m.capabilities?.includes("tools") ?? false,
								available: providerAvailable(m),
								pricing: {
										prompt: prices.prompt,
										completion: prices.completion,
								},
						};
				}),
		});
});

// Single model lookup
modelRoutes.get("/v1/models/:id", async (c) => {
		await ensureCatalogLoaded();
		const id = c.req.param("id");
		const m = listAllModels().find((x) => x.id === id);
		if (!m) {
				return c.json(
						{ error: { message: "Model not found", type: "not_found" } },
						404,
				);
		}
		const prices = facingPrices(m);
		return c.json({
				id: m.id,
				object: "model",
				created: Math.floor(Date.now() / 1000),
				owned_by: m.provider ?? "oma",
				display_name: m.displayName,
				provider: m.provider,
				category: m.category,
				modality: "chat",
				context_length: m.contextWindow ?? 0,
				supports_streaming: m.supportsStreaming,
				supports_tools: m.capabilities?.includes("tools") ?? false,
				available: providerAvailable(m),
				pricing: {
						prompt: prices.prompt,
						completion: prices.completion,
				},
		});
});


