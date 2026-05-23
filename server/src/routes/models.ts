import { Hono } from "hono";
import { optionalAuth } from "../auth/middleware.js";
import { listModels, getModel, listVideoModels } from "../inference/models.js";
import type { OmaEnv } from "../types.js";

export const modelRoutes = new Hono<OmaEnv>();

modelRoutes.use("/v1/models/*", optionalAuth);

modelRoutes.get("/v1/models", async (c) => {
  const catalog = listModels();
  const videoCatalog = listVideoModels();
  const created = Math.floor(Date.now() / 1000);

  const data = [
    ...catalog.map((m) => ({
      id: m.id,
      object: "model" as const,
      created,
      owned_by: "oma",
      pricing: {
        prompt: (m.inputPricePer1M / 1_000_000).toFixed(8),
        completion: (m.outputPricePer1M / 1_000_000).toFixed(8),
      },
      category: m.category,
      context_length: m.maxTokens,
    })),
    ...videoCatalog.map((m) => ({
      id: m.id,
      object: "model" as const,
      created,
      owned_by: "oma",
      pricing: {
        prompt: m.price.toFixed(8),
      },
      category: "video",
      duration: m.duration,
    })),
  ];

  return c.json({ object: "list", data });
});

modelRoutes.get("/v1/models/:model", async (c) => {
  const modelId = c.req.param("model");

  const modelInfo = getModel(modelId);
  if (!modelInfo) return c.json({ error: { message: `Model '${modelId}' not found`, type: "invalid_request_error" } }, 404);

  return c.json({
    id: modelInfo.id,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: "oma",
    pricing: {
      prompt: (modelInfo.inputPricePer1M / 1_000_000).toFixed(8),
      completion: (modelInfo.outputPricePer1M / 1_000_000).toFixed(8),
    },
    category: modelInfo.category,
    context_length: modelInfo.maxTokens,
    supports_streaming: modelInfo.supportsStreaming,
    provider: modelInfo.provider,
  });
});
