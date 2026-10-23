import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import {
		ensureCatalogLoaded,
		listAllModels,
		providerAvailable,
		type ModelDef,
} from "../inference/models.js";
import { userFacingFor } from "../inference/billing-service.js";

export const modelRoutes = new Hono<OmaEnv>();

/**
	* User-facing per-1M prices for a model, via the same override-aware
	* lookup billing deducts with — displayed prices always match charges.
	*/
function facingPrices(m: ModelDef) {
		const pricing = userFacingFor(m.id);
		const extended = m.extendedPricing
			? userFacingFor(m.id, m.extendedPricing.contextTokenThreshold + 1)
			: undefined;
		return {
			prompt: pricing.inputPer1M,
			completion: pricing.outputPer1M,
			...(extended && m.extendedPricing ? { extended: {
				context_token_threshold: m.extendedPricing.contextTokenThreshold,
				prompt: extended.inputPer1M,
				completion: extended.outputPer1M,
			} } : {}),
		};
}

/** One serialization contract for both catalog endpoints. */
function serializeModel(m: ModelDef) {
    return {
        id: m.id,
        object: "model",
        // No creation timestamp is supplied by the curated provider metadata.
        created: 0,
        owned_by: m.provider ?? "oma",
        display_name: m.displayName,
        ...(m.description ? { description: m.description } : {}),
        provider: m.provider,
        category: m.category,
        modality: "chat",
        context_length: m.contextWindow ?? 0,
        max_output_tokens: m.maxOutputTokens ?? m.maxTokens,
        supports_streaming: m.supportsStreaming,
        supports_tools: m.capabilities?.includes("tools") ?? false,
        capabilities: m.capabilities ?? [],
        privacy: m.privacy ?? "unverified",
        architecture: { input_modalities: m.inputModalities ?? ["text"], output_modalities: m.outputModalities ?? ["text"] },
        ...(m.metadataVerification ? { metadata_verification: {
            status: m.metadataVerification.status,
            source_url: m.metadataVerification.sourceUrl,
            verified_at: m.metadataVerification.verifiedAt,
            note: m.metadataVerification.note,
        } } : {}),
        available: providerAvailable(m),
        ...(m.disabledReason ? { unavailable_reason: m.disabledReason } : {}),
        pricing: facingPrices(m),
    };
}

// OpenAI-compatible /v1/models
modelRoutes.get("/v1/models", async (c) => {
    await ensureCatalogLoaded();
    return c.json({ object: "list", data: listAllModels().map(serializeModel) });
});

// Single model lookup
modelRoutes.get("/v1/models/:id", async (c) => {
    await ensureCatalogLoaded();
    const model = listAllModels().find((entry) => entry.id === c.req.param("id"));
    if (!model) return c.json({ error: { message: "Model not found", type: "not_found" } }, 404);
    return c.json(serializeModel(model));
});
