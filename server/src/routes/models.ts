/**
 * /v1/models — public catalog.
 *
 * Pricing format: per-token USD strings in `prompt` / `completion` keys,
 * matching the OpenAI model catalog convention. Numbers include the resolved
 * markup (per-model > tiered > OMA_MARKUP_PCT) so customers see what they
 * actually pay, NOT the wholesale rate.
 *
 * WHOLESALE LEAK BUG (audit 2026-07-16): previous implementation divided
 * models.json `inputPricePer1M` by 1M to get per-token WITHOUT applying
 * markup, leaking wholesale and giving customers a 99.99% discount. Now
 * delegated to billing-service.getModelPricing().
 */
import { Hono } from "hono";
import { optionalAuth } from "../auth/middleware.js";
import { listModels, getModel, listVideoModels } from "../inference/models.js";
import { getModelPricing } from "../inference/billing-service.js";
import { getRedisClient } from "../lib/redis-client.js";
import type { OmaEnv } from "../types.js";

const MODELS_CACHE_KEY = "cache:models:catalog:v1";
const MODELS_CACHE_TTL = 3600; // 1 hour in seconds

/**
 * Returns customer-facing per-token USD strings for a model.
 * Falls back to wholesale-per-token (no markup) ONLY if the billing service
 * throws — defensive, never expected in normal flow.
 */
async function customerPricePerToken(
  modelId: string,
  wholesaleInput: number,
  wholesaleOutput: number,
): Promise<{ prompt: string; completion: string }> {
  try {
    const p = await getModelPricing(modelId);
    // p.inputPer1k is USD per 1K input tokens (with markup).
    return {
      prompt: (p.inputPer1k / 1000).toFixed(8),
      completion: (p.outputPer1k / 1000).toFixed(8),
    };
  } catch {
    return {
      prompt: (wholesaleInput / 1_000_000).toFixed(8),
      completion: (wholesaleOutput / 1_000_000).toFixed(8),
    };
  }
}

async function buildModelsResponse(): Promise<{
  object: string;
  data: unknown[];
}> {
  const catalog = await listModels();
  const videoCatalog = await listVideoModels();
  const created = Math.floor(Date.now() / 1000);

  const data = [
    ...(
      await Promise.all(
        catalog.map(async (m) => {
          const pricing = await customerPricePerToken(
            m.id,
            m.inputPricePer1M,
            m.outputPricePer1M,
          );
          return {
            id: m.id,
            object: "model" as const,
            created,
            owned_by: "oma",
            permission: [],
            root: m.id,
            parent: null,
            pricing,
            category: m.category,
            context_length: m.maxTokens,
          };
        }),
      )
    ),
    ...videoCatalog.map((m) => ({
      id: m.id,
      object: "model" as const,
      created,
      owned_by: "oma",
      permission: [],
      root: m.id,
      parent: null,
      pricing: {
        prompt: m.price.toFixed(8),
      },
      category: "video",
      duration: m.duration,
    })),
  ];

  return { object: "list", data };
}

export const modelRoutes = new Hono<OmaEnv>();

modelRoutes.use("/v1/models/*", optionalAuth);

modelRoutes.get("/v1/models", async (c) => {
  // Try Redis cache first
  const redis = await getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(MODELS_CACHE_KEY);
      if (cached) {
        c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=1800");
        c.header("Vary", "Accept-Encoding");
        c.header("X-Cache", "HIT");
        return c.json(JSON.parse(cached));
      }
    } catch {
      // Cache miss or error - fall through to rebuild
    }
  }

  // Build fresh response
  const response = await buildModelsResponse();

  // Store in Redis cache
  if (redis) {
    try {
      await redis.setEx(MODELS_CACHE_KEY, MODELS_CACHE_TTL, JSON.stringify(response));
    } catch {
      // Ignore cache write errors
    }
  }

  c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=1800");
  c.header("Vary", "Accept-Encoding");
  c.header("X-Cache", "MISS");
  return c.json(response);
});

modelRoutes.get("/v1/models/:model", async (c) => {
  const modelId = c.req.param("model");

  const modelInfo = await getModel(modelId);
  if (!modelInfo) return c.json({ error: { message: `Model '${modelId}' not found`, type: "invalid_request_error" } }, 404);

  return c.json({
    id: modelInfo.id,
    object: "model",
    created: Math.floor(Date.now() / 1000),
    owned_by: "oma",
    permission: [],
    root: modelInfo.id,
    parent: null,
    pricing: await customerPricePerToken(
      modelInfo.id,
      modelInfo.inputPricePer1M,
      modelInfo.outputPricePer1M,
    ),
    category: modelInfo.category,
    context_length: modelInfo.maxTokens,
    supports_streaming: modelInfo.supportsStreaming,
    provider: modelInfo.provider,
  });
});

/**
 * Invalidate the models cache. Called when model catalog is reloaded.
 * Exported for use by admin tooling / tests.
 */
export async function invalidateModelsCache(): Promise<void> {
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.del(MODELS_CACHE_KEY);
    } catch {
      // Ignore
    }
  }
}
