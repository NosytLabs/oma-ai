import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import { config } from "../config.js";
import { ensureCatalogLoaded } from "../inference/models.js";
import { getModelPricing } from "../inference/billing-service.js";
import { listAllModels } from "../inference/models.js";

export const modelRoutes = new Hono<OmaEnv>();

// OpenAI-compatible /v1/models
modelRoutes.get("/v1/models", async (c) => {
  await ensureCatalogLoaded();
  const models = listAllModels();
  return c.json({
    object: "list",
    data: models.map((m) => ({
      id: m.id,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: m.provider ?? "oma",
      context_length: m.contextWindow ?? 0,
      supports_streaming: m.supportsStreaming,
      supports_tools: m.capabilities?.includes("tools") ?? false,
      pricing: {
        prompt: m.inputPricePer1M,
        completion: m.outputPricePer1M,
      },
    })),
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
  return c.json({
    id: m.id,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: m.provider ?? "oma",
    context_length: m.contextWindow ?? 0,
    supports_streaming: m.supportsStreaming,
    supports_tools: m.capabilities?.includes("tools") ?? false,
    pricing: {
      prompt: m.inputPricePer1M,
      completion: m.outputPricePer1M,
    },
  });
});

void config;
void getModelPricing;
