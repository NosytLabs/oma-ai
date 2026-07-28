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
import { listModels, getModel, listVideoModels, listImageModels, getImageModel, listTtsModels, listEmbeddingModels, listAsrModels, listMusicModels, listUpscaleModels, listInpaintModels } from "../inference/models.js";
import { hasConfiguredProvider } from "../inference/cross-provider-router.js";
import { getModelPricing } from "../inference/billing-service.js";
import { getRedisClient } from "../lib/redis-client.js";
import { logger } from "../lib/logger.js";
import type { OmaEnv } from "../types.js";

// v2: response entries now carry `provider` (upstream routing target).
// v3: catalog is filtered by provider credentials (hasConfiguredProvider) —
//     keyless deploys must not serve a stale cache that advertises Venice.
// v4: OpenRouter-schema enrichment — entries now carry `architecture`,
//     `supported_parameters`, and `canonical_slug` so agent tools (Cline,
//     LiteLLM) can auto-consume the catalog.
// v5: pricing now actually applies the resolved markup (audit 2026-07-26:
//     getModelPricing returns wholesale per-1k + markup % separately, and
//     the old code forgot to multiply — the whole catalog understated real
//     billed prices by the markup, typically 25%).
const MODELS_CACHE_KEY = "cache:models:catalog:v5";
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
    // p.inputPer1k / p.outputPer1k are WHOLESALE USD per 1K tokens; the
    // resolved markup comes back separately in p.markup and must be applied
    // here so the published price matches what calculateCost actually bills.
    const markupMultiplier = 1 + p.markup / 100;
    return {
      prompt: ((p.inputPer1k * markupMultiplier) / 1000).toFixed(8),
      completion: ((p.outputPer1k * markupMultiplier) / 1000).toFixed(8),
    };
  } catch (err) {
    logger.debug({ err }, "[models] pricing conversion failed, falling back to wholesale");
    return {
      prompt: (wholesaleInput / 1_000_000).toFixed(8),
      completion: (wholesaleOutput / 1_000_000).toFixed(8),
    };
  }
}

/**
 * OpenRouter de-facto schema helpers. Modalities and parameters are derived
 * from the capability strings in models.json (see MODEL_CATALOG entries):
 * "vision" → image input, "audio-input" → audio input, "video-input" →
 * video input, "image-generation" → image output, "video-generation" → video
 * output, "tools"/"function-calling" → tools + tool_choice,
 * "structured-output"/"json" → response_format.
 */
function deriveArchitecture(capabilities: readonly string[]): {
  input_modalities: string[];
  output_modalities: string[];
} {
  const input_modalities = ["text"];
  const output_modalities: string[] = ["text"];
  if (capabilities.includes("vision")) input_modalities.push("image");
  if (capabilities.includes("audio-input")) input_modalities.push("audio");
  if (capabilities.includes("video-input")) input_modalities.push("video");
  if (capabilities.includes("image-generation")) output_modalities.push("image");
  if (capabilities.includes("video-generation")) output_modalities.push("video");
  return { input_modalities, output_modalities };
}

const BASE_SUPPORTED_PARAMETERS = [
  "temperature",
  "top_p",
  "max_tokens",
  "stream",
  "frequency_penalty",
  "presence_penalty",
  "stop",
] as const;

function deriveSupportedParameters(capabilities: readonly string[]): string[] {
  const params: string[] = [...BASE_SUPPORTED_PARAMETERS];
  if (capabilities.includes("tools") || capabilities.includes("function-calling")) {
    params.push("tools", "tool_choice");
  }
  if (capabilities.includes("structured-output") || capabilities.includes("json")) {
    params.push("response_format");
  }
  return params;
}

async function buildModelsResponse(): Promise<{
  object: string;
  data: unknown[];
}> {
  const catalog = await listModels();
  const videoCatalog = await listVideoModels();
  const imageCatalog = await listImageModels();
  const ttsCatalog = await listTtsModels();
  const embeddingCatalog = await listEmbeddingModels();
  const asrCatalog = await listAsrModels();
  const musicCatalog = await listMusicModels();
  const upscaleCatalog = await listUpscaleModels();
  const inpaintCatalog = await listInpaintModels();
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
          const capabilities = m.capabilities ?? [];
          return {
            id: m.id,
            canonical_slug: m.id,
            display_name: m.displayName,
            object: "model" as const,
            created,
            owned_by: "oma",
            provider: m.provider,
            permission: [],
            root: m.id,
            parent: null,
            pricing,
            category: m.category,
            context_length: m.maxTokens,
            architecture: deriveArchitecture(capabilities),
            supported_parameters: deriveSupportedParameters(capabilities),
          };
        }),
      )
    ),
    ...imageCatalog.map((m) => {
      // Apply per-model markup so customers see the billed price.
      const multiplier = 1 + (m.markupPercent ?? 0) / 100;
      const retailPrice = m.pricePerImage * multiplier;
      return {
        id: m.id,
        canonical_slug: m.id,
        object: "model" as const,
        created,
        owned_by: "oma",
        provider: m.provider,
        permission: [],
        root: m.id,
        parent: null,
        pricing: {
          prompt: retailPrice.toFixed(8),
          generation: retailPrice.toFixed(8),
        },
        category: "image",
        architecture: {
          input_modalities: ["text"],
          output_modalities: ["image"],
        },
        supported_parameters: [] as string[],
      };
    }),
    ...videoCatalog.map((m) => ({
      id: m.id,
      canonical_slug: m.id,
      object: "model" as const,
      created,
      owned_by: "oma",
      provider: m.provider,
      permission: [],
      root: m.id,
      parent: null,
      pricing: {
        prompt: m.price.toFixed(8),
      },
      category: "video",
      duration: m.duration,
      architecture: { input_modalities: ["text"], output_modalities: ["video"] },
      supported_parameters: [] as string[],
    })),
    ...ttsCatalog.map((m) => {
      const multiplier = 1 + (m.markupPercent ?? 0) / 100;
      const retailPrice = m.inputPricePer1M * multiplier;
      return {
        id: m.id,
        canonical_slug: m.id,
        object: "model" as const,
        created,
        owned_by: "oma",
        provider: m.provider,
        permission: [],
        root: m.id,
        parent: null,
        pricing: {
          prompt: retailPrice.toFixed(8),
          completion: "0",
        },
        category: "tts",
        context_length: m.maxTokens,
        architecture: {
          input_modalities: ["text"],
          output_modalities: ["audio"],
        },
        supported_parameters: ["voice", "speed", "response_format"],
      };
    }),
    ...embeddingCatalog.map((m) => {
      const multiplier = 1 + (m.markupPercent ?? 0) / 100;
      const retailPrice = m.inputPricePer1M * multiplier;
      return {
        id: m.id,
        canonical_slug: m.id,
        object: "model" as const,
        created,
        owned_by: "oma",
        provider: m.provider,
        permission: [],
        root: m.id,
        parent: null,
        pricing: {
          prompt: retailPrice.toFixed(8),
          completion: retailPrice.toFixed(8),
        },
        category: "embedding",
        context_length: m.maxTokens,
        architecture: {
          input_modalities: ["text"],
          output_modalities: ["embeddings"],
        },
        supported_parameters: ["encoding_format", "dimensions"],
      };
    }),
    ...asrCatalog.map((m) => {
      const multiplier = 1 + (m.markupPercent ?? 0) / 100;
      const retailPrice = (m.pricePerSecond ?? 0) * multiplier;
      return {
        id: m.id,
        canonical_slug: m.id,
        object: "model" as const,
        created,
        owned_by: "oma",
        provider: m.provider,
        permission: [],
        root: m.id,
        parent: null,
        pricing: {
          prompt: retailPrice.toFixed(8),
          audio_second: retailPrice.toFixed(8),
        },
        category: "asr",
        architecture: {
          input_modalities: ["audio"],
          output_modalities: ["text"],
        },
        supported_parameters: ["language", "response_format", "temperature"],
      };
    }),
    ...musicCatalog.map((m) => {
      const multiplier = 1 + (m.markupPercent ?? 0) / 100;
      const retailPrice = (m.pricePerGeneration ?? 0) * multiplier;
      return {
        id: m.id,
        canonical_slug: m.id,
        object: "model" as const,
        created,
        owned_by: "oma",
        provider: m.provider,
        permission: [],
        root: m.id,
        parent: null,
        pricing: {
          prompt: retailPrice.toFixed(8),
          generation: retailPrice.toFixed(8),
        },
        category: "music",
        architecture: {
          input_modalities: ["text"],
          output_modalities: ["audio"],
        },
        supported_parameters: ["duration"],
      };
    }),
    ...upscaleCatalog.map((m) => {
      const multiplier = 1 + (m.markupPercent ?? 0) / 100;
      const retailPrice = (m.pricePerUpscale ?? 0) * multiplier;
      return {
        id: m.id,
        canonical_slug: m.id,
        object: "model" as const,
        created,
        owned_by: "oma",
        provider: m.provider,
        permission: [],
        root: m.id,
        parent: null,
        pricing: {
          prompt: retailPrice.toFixed(8),
          generation: retailPrice.toFixed(8),
        },
        category: "upscale",
        architecture: {
          input_modalities: ["image"],
          output_modalities: ["image"],
        },
        supported_parameters: ["scale"],
      };
    }),
    ...inpaintCatalog.map((m) => {
      const multiplier = 1 + (m.markupPercent ?? 0) / 100;
      const retailPrice = (m.pricePerEdit ?? 0) * multiplier;
      return {
        id: m.id,
        canonical_slug: m.id,
        object: "model" as const,
        created,
        owned_by: "oma",
        provider: m.provider,
        permission: [],
        root: m.id,
        parent: null,
        pricing: {
          prompt: retailPrice.toFixed(8),
          generation: retailPrice.toFixed(8),
        },
        category: "inpaint",
        architecture: {
          input_modalities: ["text", "image"],
          output_modalities: ["image"],
        },
        supported_parameters: ["mask", "prompt_strength"],
      };
    }),
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
  // Treat models with no configured provider (e.g. Venice models on a keyless
  // deploy) as absent — they are filtered from the list endpoint and would
  // only 503 on use, so don't advertise them here either.
  if (!modelInfo || modelInfo.enabled === false || !hasConfiguredProvider(modelInfo)) {
    // Fall through to image model lookup
    const imgInfo = await getImageModel(modelId);
    if (!imgInfo || imgInfo.enabled === false) {
      return c.json({ error: { message: `Model '${modelId}' not found`, type: "invalid_request_error" } }, 404);
    }
    const imgMultiplier = 1 + (imgInfo.markupPercent ?? 0) / 100;
    const imgRetailPrice = imgInfo.pricePerImage * imgMultiplier;
    return c.json({
      id: imgInfo.id,
      canonical_slug: imgInfo.id,
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "oma",
      permission: [],
      root: imgInfo.id,
      parent: null,
      pricing: {
        prompt: imgRetailPrice.toFixed(8),
        generation: imgRetailPrice.toFixed(8),
      },
      category: "image",
      provider: imgInfo.provider,
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["image"],
      },
      supported_parameters: [] as string[],
    });
  }

  const capabilities = modelInfo.capabilities ?? [];
  return c.json({
    id: modelInfo.id,
    canonical_slug: modelInfo.id,
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
    architecture: deriveArchitecture(capabilities),
    supported_parameters: deriveSupportedParameters(capabilities),
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
