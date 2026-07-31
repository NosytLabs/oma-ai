import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import { ensureCatalogLoaded, listAllModels } from "../inference/models.js";
import { getModelPricingOverride } from "./admin/index.js";

export const modelRoutes = new Hono<OmaEnv>();

// OpenAI-compatible /v1/models
modelRoutes.get("/v1/models", async (c) => {
  await ensureCatalogLoaded();
  const models = listAllModels();
  return c.json({
    object: "list",
    data: models.map((m) => {
      // Admin-set pricing override wins over the catalog default so that
      // dashboards, chat cost pills, and billing all see the same number
      // as the admin's pricing editor.
      const override = getModelPricingOverride(m.id);
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
        pricing: {
          prompt: override?.inputPricePer1M ?? m.inputPricePer1M,
          completion: override?.outputPricePer1M ?? m.outputPricePer1M,
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
  const override = getModelPricingOverride(m.id);
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
    pricing: {
      prompt: override?.inputPricePer1M ?? m.inputPricePer1M,
      completion: override?.outputPricePer1M ?? m.outputPricePer1M,
    },
  });
});


