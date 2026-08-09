import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import {
  ensureCatalogLoaded,
  listAllModels,
  providerAvailable,
  userFacingPrices,
  type ModelDef,
} from "../inference/models.js";
import { readModelPricingOverrides } from "../lib/model-overrides.js";

export const modelRoutes = new Hono<OmaEnv>();

/**
 * User-facing per-1M prices for a model: admin overrides are final
 * user-facing prices; otherwise catalog base * (1 + markup/100).
 * Displayed prices must always match what billing deducts.
 */
function facingPrices(
  m: ModelDef,
  overrides: ReturnType<typeof readModelPricingOverrides>,
): { prompt: number; completion: number } {
  const override = overrides[m.id];
  if (override) {
    return {
      prompt: override.inputPricePer1M,
      completion: override.outputPricePer1M,
    };
  }
  const facing = userFacingPrices(m);
  return { prompt: facing.inputPer1M, completion: facing.outputPer1M };
}

// OpenAI-compatible /v1/models
modelRoutes.get("/v1/models", async (c) => {
  await ensureCatalogLoaded();
  const models = listAllModels();
  const allOverrides = readModelPricingOverrides();
  return c.json({
    object: "list",
    data: models.map((m) => {
      // Prices are user-facing (markup applied) so dashboards, chat cost
      // pills, and billing all show the same number the customer is charged.
      const prices = facingPrices(m, allOverrides);
      return {
        id: m.id,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: m.provider ?? "oma",
        display_name: m.displayName,
        provider: m.provider,
        category: m.category,
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
  const allOverrides = readModelPricingOverrides();
  const prices = facingPrices(m, allOverrides);
  return c.json({
    id: m.id,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: m.provider ?? "oma",
    display_name: m.displayName,
    provider: m.provider,
    category: m.category,
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


