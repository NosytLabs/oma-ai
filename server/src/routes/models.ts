import { Hono } from "hono";
import { optionalAuth } from "../auth/middleware.js";
import { listModels, getModel } from "../inference/models.js";
import { getStakingDiscount } from "../credits/balance.js";
import type { OmaEnv } from "../types.js";

export const modelRoutes = new Hono<OmaEnv>();

modelRoutes.use("/v1/models/*", optionalAuth);

modelRoutes.get("/v1/models", async (c) => {
  const userId = c.get("userId");
  const catalog = listModels();
  const created = Math.floor(Date.now() / 1000);

  const data = catalog.map((m) => ({
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
  }));

  if (userId) {
    const discount = await getStakingDiscount(userId);
    c.header("X-Staking-Discount", String(discount));
  }

  return c.json({ object: "list", data });
});

modelRoutes.get("/v1/models/:model", async (c) => {
  const modelId = c.req.param("model");
  const userId = c.get("userId");

  const modelInfo = getModel(modelId);
  if (!modelInfo) return c.json({ error: { message: `Model '${modelId}' not found`, type: "invalid_request_error" } }, 404);

  let effectivePrompt = (modelInfo.inputPricePer1M / 1_000_000).toFixed(8);
  let effectiveCompletion = (modelInfo.outputPricePer1M / 1_000_000).toFixed(8);

  if (userId) {
    const discount = await getStakingDiscount(userId);
    if (discount > 0) {
      effectivePrompt = (modelInfo.inputPricePer1M / 1_000_000 * (1 - discount / 100)).toFixed(8);
      effectiveCompletion = (modelInfo.outputPricePer1M / 1_000_000 * (1 - discount / 100)).toFixed(8);
    }
    c.header("X-Staking-Discount", String(discount));
  }

  return c.json({
    id: modelInfo.id,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: "oma",
    pricing: {
      prompt: (modelInfo.inputPricePer1M / 1_000_000).toFixed(8),
      completion: (modelInfo.outputPricePer1M / 1_000_000).toFixed(8),
    },
    effective_pricing: { prompt: effectivePrompt, completion: effectiveCompletion },
    category: modelInfo.category,
    context_length: modelInfo.maxTokens,
    supports_streaming: modelInfo.supportsStreaming,
    provider: modelInfo.provider,
  });
});
