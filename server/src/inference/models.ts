import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { invalidateModelsCache } from "../routes/models.js";
import { hasConfiguredProvider, isProviderConfigured } from "./cross-provider-router.js";

export interface ModelDef {
  id: string;
  veniceId?: string;
  surplusId?: string;
  gonkaId?: string;
  provider: "venice" | "surplus" | "gonka" | "both" | "all";
  primaryProvider: "venice" | "surplus" | "gonka";
  inputPricePer1M: number;
  outputPricePer1M: number;
  markupPercent: number;
  category: "budget" | "mid" | "premium" | "frontier";
  /**
   * Conservative default output-token budget (feeds billing's maxTokens/4
   * heuristic). This is NOT the advertised context window — see contextWindow.
   */
  maxTokens: number;
  /** True advertised context window in tokens (exposed as /v1/models `context_length`). */
  contextWindow?: number;
  /** Maximum completion/output tokens the upstream allows. */
  maxOutputTokens?: number;
  supportsStreaming: boolean;
  displayName: string;
  capabilities: string[];
  description: string;
  creditsPerMillionInput: number;
  creditsPerMillionOutput: number;
  /** Set to false in models.json to hide a model from the live catalog without removing it. */
  enabled?: boolean;
}

export const WHISPER_MODEL = "whisper-1";

export interface VideoModelDef {
  id: string;
  provider: "venice";
  price: number;
  duration: string;
  resolution?: string;
  displayName: string;
  capabilities: string[];
  description: string;
  creditsPerMillionInput: number;
  creditsPerMillionOutput: number;
  creditsPrice: number;
}

export interface ImageModelDef {
  id: string;
  veniceId?: string;
  provider: "venice";
  primaryProvider: "venice";
  inputPricePer1M: number;
  outputPricePer1M: number;
  /** Per-image wholesale price in USD (Venice charges per generation, not per token). */
  pricePerImage: number;
  markupPercent: number;
  category: "image";
  maxTokens: number;
  supportsStreaming: boolean;
  displayName: string;
  capabilities: string[];
  description: string;
  /** Credits charged per generated image (1 credit = $0.01). */
  creditsPrice: number;
  /** Optional: default width supported. */
  defaultWidth?: number;
  /** Optional: default height supported. */
  defaultHeight?: number;
  enabled?: boolean;
}

/** Text-to-speech model — charged per input token (or per char for some Venice TTS). */
export interface TtsModelDef {
  id: string;
  veniceId?: string;
  provider: "venice";
  primaryProvider: "venice";
  inputPricePer1M: number;
  outputPricePer1M: number;
  markupPercent: number;
  category: "tts";
  maxTokens: number;
  supportsStreaming: boolean;
  displayName: string;
  capabilities: string[];
  description: string;
  creditsPerMillionInput: number;
  creditsPerMillionOutput: number;
  responseFormat?: string[];
  enabled?: boolean;
}

/** Embedding model — charged per input token. Output also costs tokens in some catalogs. */
export interface EmbeddingModelDef {
  id: string;
  veniceId?: string;
  provider: "venice";
  primaryProvider: "venice";
  inputPricePer1M: number;
  outputPricePer1M: number;
  markupPercent: number;
  category: "embedding";
  maxTokens: number;
  supportsStreaming: boolean;
  displayName: string;
  capabilities: string[];
  description: string;
  creditsPerMillionInput: number;
  creditsPerMillionOutput: number;
  dimensions?: number;
  enabled?: boolean;
}

/** Speech-to-text model — charged per second of input audio. */
export interface AsrModelDef {
  id: string;
  veniceId?: string;
  provider: "venice";
  primaryProvider: "venice";
  /** Per-second USD wholesale price. */
  pricePerSecond: number;
  markupPercent: number;
  category: "asr";
  maxTokens: number;
  supportsStreaming: boolean;
  displayName: string;
  capabilities: string[];
  description: string;
  creditsPrice: number;
  creditsPerMillionInput: number;
  creditsPerMillionOutput: number;
  enabled?: boolean;
}

/** Music generation model — charged per generation (track). */
export interface MusicModelDef {
  id: string;
  veniceId?: string;
  provider: "venice";
  primaryProvider: "venice";
  /** Per-generation USD wholesale price. */
  pricePerGeneration: number;
  markupPercent: number;
  category: "music";
  maxTokens: number;
  supportsStreaming: boolean;
  displayName: string;
  capabilities: string[];
  description: string;
  creditsPrice: number;
  creditsPerMillionInput: number;
  creditsPerMillionOutput: number;
  enabled?: boolean;
}

/** Image upscale model — charged per upscale operation. */
export interface UpscaleModelDef {
  id: string;
  veniceId?: string;
  provider: "venice";
  primaryProvider: "venice";
  pricePerUpscale: number;
  markupPercent: number;
  category: "upscale";
  maxTokens: number;
  supportsStreaming: boolean;
  displayName: string;
  capabilities: string[];
  description: string;
  creditsPrice: number;
  creditsPerMillionInput: number;
  creditsPerMillionOutput: number;
  enabled?: boolean;
}

/** Image edit / inpaint model — charged per edit. */
export interface InpaintModelDef {
  id: string;
  veniceId?: string;
  provider: "venice";
  primaryProvider: "venice";
  pricePerEdit: number;
  markupPercent: number;
  category: "inpaint";
  maxTokens: number;
  supportsStreaming: boolean;
  displayName: string;
  capabilities: string[];
  description: string;
  creditsPrice: number;
  creditsPerMillionInput: number;
  creditsPerMillionOutput: number;
  enabled?: boolean;
}

let MODEL_CATALOG: Record<string, ModelDef> = {};
export let VIDEO_MODELS: Record<string, VideoModelDef> = {};
export let IMAGE_MODELS: Record<string, ImageModelDef> = {};
export let TTS_MODELS: Record<string, TtsModelDef> = {};
export let EMBEDDING_MODELS: Record<string, EmbeddingModelDef> = {};
export let ASR_MODELS: Record<string, AsrModelDef> = {};
export let MUSIC_MODELS: Record<string, MusicModelDef> = {};
export let UPSCALE_MODELS: Record<string, UpscaleModelDef> = {};
export let INPAINT_MODELS: Record<string, InpaintModelDef> = {};

const FALLBACK_MODELS: Record<string, ModelDef> = {
  "deepseek-v3.2": {
    id: "deepseek-v3.2",
    veniceId: "deepseek-v3.2",
    provider: "venice",
    primaryProvider: "venice",
    inputPricePer1M: 0.50,
    outputPricePer1M: 1.50,
    markupPercent: 10,
    category: "premium",
    maxTokens: 65536,
    supportsStreaming: true,
    displayName: "DeepSeek V3.2",
    capabilities: ["chat", "code", "reasoning"],
    description: "DeepSeek's latest flagship model",
    creditsPerMillionInput: 500,
    creditsPerMillionOutput: 1500,
  },
  "llama-3.3-70b": {
    id: "llama-3.3-70b",
    veniceId: "llama-3.3-70b",
    provider: "venice",
    primaryProvider: "venice",
    inputPricePer1M: 0.35,
    outputPricePer1M: 0.90,
    markupPercent: 10,
    category: "mid",
    maxTokens: 8192,
    supportsStreaming: true,
    displayName: "Llama 3.3 70B",
    capabilities: ["chat", "code"],
    description: "Meta's latest 70B model",
    creditsPerMillionInput: 350,
    creditsPerMillionOutput: 900,
  },
  "llama-3.2-3b": {
    id: "llama-3.2-3b",
    veniceId: "llama-3.2-3b",
    provider: "venice",
    primaryProvider: "venice",
    inputPricePer1M: 0.06,
    outputPricePer1M: 0.12,
    markupPercent: 10,
    category: "budget",
    maxTokens: 8192,
    supportsStreaming: true,
    displayName: "Llama 3.2 3B",
    capabilities: ["chat"],
    description: "Fast, lightweight model",
    creditsPerMillionInput: 60,
    creditsPerMillionOutput: 120,
  },
};

const FALLBACK_VIDEO_MODELS: Record<string, VideoModelDef> = {
  "seedance-2-0-text-to-video": {
    id: "seedance-2-0-text-to-video",
    provider: "venice",
    price: 0.90,
    duration: "5s",
    displayName: "Seedance 2.0 Text-to-Video",
    capabilities: ["video-generation", "text-to-video"],
    description: "Seedance 2.0 for text-to-video generation",
    creditsPerMillionInput: 0,
    creditsPerMillionOutput: 0,
    creditsPrice: 900,
  },
  "kling-v3-pro-text-to-video": {
    id: "kling-v3-pro-text-to-video",
    provider: "venice",
    price: 0.92,
    duration: "5s",
    displayName: "Kling 3.0 Pro Text-to-Video",
    capabilities: ["video-generation", "text-to-video"],
    description: "Kling 3.0 Pro for text-to-video generation",
    creditsPerMillionInput: 0,
    creditsPerMillionOutput: 0,
    creditsPrice: 920,
  },
};

const FALLBACK_IMAGE_MODELS: Record<string, ImageModelDef> = {
  "venice-sd35": {
    id: "venice-sd35",
    veniceId: "venice-sd35",
    provider: "venice",
    primaryProvider: "venice",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    pricePerImage: 0.01,
    markupPercent: 25,
    category: "image",
    maxTokens: 1,
    supportsStreaming: false,
    displayName: "Venice SD35",
    capabilities: ["image-generation", "text-to-image"],
    description: "Stable Diffusion 3.5 served by Venice — fast, cheap, photoreal.",
    creditsPrice: 2,
  },
};

const FALLBACK_TTS_MODELS: Record<string, TtsModelDef> = {
  "tts-kokoro": {
    id: "tts-kokoro",
    veniceId: "tts-kokoro",
    provider: "venice",
    primaryProvider: "venice",
    inputPricePer1M: 3.5,
    outputPricePer1M: 0.0,
    markupPercent: 25,
    category: "tts",
    maxTokens: 4096,
    supportsStreaming: true,
    displayName: "Kokoro TTS",
    capabilities: ["text-to-speech", "audio-output"],
    description: "Kokoro text-to-speech via Venice — high-quality natural voices.",
    creditsPerMillionInput: 438,
    creditsPerMillionOutput: 0,
    responseFormat: ["mp3", "opus", "wav", "pcm"],
  },
};

const FALLBACK_EMBEDDING_MODELS: Record<string, EmbeddingModelDef> = {
  "text-embedding-bge-m3": {
    id: "text-embedding-bge-m3",
    veniceId: "text-embedding-bge-m3",
    provider: "venice",
    primaryProvider: "venice",
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.15,
    markupPercent: 25,
    category: "embedding",
    maxTokens: 8192,
    supportsStreaming: false,
    displayName: "BGE-M3 Embeddings",
    capabilities: ["embeddings", "vector-output"],
    description: "BGE-M3 multilingual embeddings via Venice.",
    creditsPerMillionInput: 19,
    creditsPerMillionOutput: 19,
    dimensions: 1024,
  },
};

let catalogPromise: Promise<void> | null = null;

export function ensureCatalogLoaded(): Promise<void> {
  if (!catalogPromise) {
    catalogPromise = reloadModelCatalog();
  }
  return catalogPromise;
}

export async function reloadModelCatalog(): Promise<void> {
  const configPath = config.MODELS_CONFIG_PATH || path.join(process.cwd(), 'models.json');
  let loadedFromDisk = false;
  try {
    const data = await fs.promises.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(data);
    MODEL_CATALOG = parsed.MODEL_CATALOG || FALLBACK_MODELS;
    VIDEO_MODELS = parsed.VIDEO_MODELS || FALLBACK_VIDEO_MODELS;
    IMAGE_MODELS = parsed.IMAGE_MODELS || FALLBACK_IMAGE_MODELS;
    TTS_MODELS = parsed.TTS_MODELS || FALLBACK_TTS_MODELS;
    EMBEDDING_MODELS = parsed.EMBEDDING_MODELS || FALLBACK_EMBEDDING_MODELS;
    ASR_MODELS = parsed.ASR_MODELS || {};
    MUSIC_MODELS = parsed.MUSIC_MODELS || {};
    UPSCALE_MODELS = parsed.UPSCALE_MODELS || {};
    INPAINT_MODELS = parsed.INPAINT_MODELS || {};
    loadedFromDisk = parsed.MODEL_CATALOG !== undefined;
    logger.info({
      modelCount: Object.keys(MODEL_CATALOG).length,
      videoModelCount: Object.keys(VIDEO_MODELS).length,
      imageModelCount: Object.keys(IMAGE_MODELS).length,
      ttsModelCount: Object.keys(TTS_MODELS).length,
      embeddingModelCount: Object.keys(EMBEDDING_MODELS).length,
      asrModelCount: Object.keys(ASR_MODELS).length,
      musicModelCount: Object.keys(MUSIC_MODELS).length,
      upscaleModelCount: Object.keys(UPSCALE_MODELS).length,
      inpaintModelCount: Object.keys(INPAINT_MODELS).length,
      configPath,
      source: loadedFromDisk ? 'models.json' : 'fallback',
      type: 'model_catalog_loaded'
    });
  } catch (error) {
    logger.warn({ configPath, error: error instanceof Error ? error.message : String(error), type: 'model_catalog_fallback' }, 'Failed to load models.json, using fallback models');
    MODEL_CATALOG = FALLBACK_MODELS;
    VIDEO_MODELS = FALLBACK_VIDEO_MODELS;
    IMAGE_MODELS = FALLBACK_IMAGE_MODELS;
    TTS_MODELS = FALLBACK_TTS_MODELS;
    EMBEDDING_MODELS = FALLBACK_EMBEDDING_MODELS;
    ASR_MODELS = {};
    MUSIC_MODELS = {};
    UPSCALE_MODELS = {};
    INPAINT_MODELS = {};
  }
  // Audit the catalog AFTER both success and failure paths so operators
  // see the same warnings no matter which catalog got loaded.
  auditMarkupSanity(MODEL_CATALOG);
  runExpectedMarkupAudit(MODEL_CATALOG);
  await invalidateModelsCache();
}

/**
 * Emits a WARN for every paid model whose `markupPercent` is missing or <= 0.
 * Explicitly free models (both token prices are zero) are intentionally exempt:
 * their zero markup is a product decision, not a loss-making paid route.
 * Operators see the warning once per process (not per request) at startup.
 */
function auditMarkupSanity(catalog: Record<string, ModelDef>): void {
  if (!catalog) return;
  const offenders: Array<{ id: string; markupPercent: number }> = [];
  for (const [id, def] of Object.entries(catalog)) {
    const isExplicitlyFree = def?.inputPricePer1M === 0 && def?.outputPricePer1M === 0;
    if (!isExplicitlyFree && (!Number.isFinite(def?.markupPercent) || def.markupPercent <= 0)) {
      offenders.push({ id, markupPercent: def?.markupPercent ?? NaN });
    }
  }
  if (offenders.length > 0) {
    logger.warn({
      offenderCount: offenders.length,
      offenders: offenders.slice(0, 25),
      truncated: offenders.length > 25,
      type: 'model_markup_missing_or_zero',
    }, `[models] ${offenders.length} model(s) have missing or non-positive markupPercent — OMA is selling these at a loss until models.json is updated.`);
  }
}

/**
 * Parses the `OMA_MODEL_MARKUP_OVERRIDES` env var (format
 * "model-a=25,model-b=10") as the operator's *expected* markup floor.
 * Logs a HIGH-severity WARN for every catalog entry whose actual markup
 * is below the expected floor — i.e. price-drift between the upstream
 * config and what the operator believes billing should be.
 *
 * This is the static-price-drift guard: if Venice raises upstream prices
 * and operators forget to update models.json, this fires at boot.
 */
function runExpectedMarkupAudit(catalog: Record<string, ModelDef>): void {
  const expected = parseModelMarkupOverrides(config.OMA_MODEL_MARKUP_OVERRIDES);
  if (!expected || Object.keys(expected).length === 0) return;
  if (!catalog) return;
  const drift: Array<{ id: string; expected: number; actual: number }> = [];
  for (const [id, expectedPct] of Object.entries(expected)) {
    const def = catalog[id];
    const actualPct = def?.markupPercent ?? 0;
    if (actualPct < expectedPct) {
      drift.push({ id, expected: expectedPct, actual: actualPct });
    }
  }
  if (drift.length > 0) {
    logger.warn({
      driftCount: drift.length,
      drift: drift.slice(0, 25),
      truncated: drift.length > 25,
      type: 'price_drift_detected',
    }, `[models] Price-drift detected: ${drift.length} model(s) have markupPercent BELOW operator-expected floor (OMA_MODEL_MARKUP_OVERRIDES). Likely selling at a loss — sync models.json with upstream pricing.`);
  }
}

/**
 * Public, exported so tests + admin tooling can call this on demand without
 * re-running the env-var audit. Returns the drift list — empty when there
 * is no drift.
 */
export function detectPriceDrift(
  catalog: Record<string, ModelDef>,
  expectedOverrides: Record<string, number>,
): Array<{ id: string; expected: number; actual: number }> {
  const out: Array<{ id: string; expected: number; actual: number }> = [];
  if (!expectedOverrides || !catalog) return out;
  for (const [id, expectedPct] of Object.entries(expectedOverrides)) {
    const def = catalog[id];
    const actualPct = def?.markupPercent ?? 0;
    if (actualPct < expectedPct) {
      out.push({ id, expected: expectedPct, actual: actualPct });
    }
  }
  return out;
}

function parseModelMarkupOverrides(raw: string | undefined): Record<string, number> | null {
  if (!raw || typeof raw !== 'string') return null;
  const out: Record<string, number> = {};
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const id = trimmed.slice(0, eq).trim();
    const value = Number(trimmed.slice(eq + 1).trim());
    if (!Number.isFinite(value)) continue;
    if (!id) continue;
    out[id] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  discountPercent: number = 0
): Promise<{ costCents: string; markupCents: string; totalCents: string }> {
  await ensureCatalogLoaded();
  const model = MODEL_CATALOG[modelId];
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const baseInputCost = (inputTokens / 1_000_000) * model.inputPricePer1M;
  const baseOutputCost = (outputTokens / 1_000_000) * model.outputPricePer1M;
  const baseCost = baseInputCost + baseOutputCost;

  const markup = baseCost * (model.markupPercent / 100);
  const grossTotal = baseCost + markup;

  const discount = grossTotal * (discountPercent / 100);
  const netTotal = grossTotal - discount;

  // Sub-cent accuracy (audit 2026-07-26): the old whole-cent ceil + 1¢ floor
  // billed a ~$0.000007 Gonka call at 1¢ (~1400× over) and made
  // costCents + markupCents ≠ totalCents, corrupting admin margin math.
  // usage_records columns are numeric(18,2) cents, so 0.01¢ ($0.0001) is the
  // storable minimum — round to that precision and keep the columns additive.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const costCents = round2(baseCost * 100);
  const markupCents = round2(markup * 100);
  const netCents = netTotal * 100;
  const totalCents = netCents > 0 ? Math.max(0.01, round2(netCents)) : 0;

  return {
    costCents: costCents.toFixed(2),
    markupCents: markupCents.toFixed(2),
    totalCents: totalCents.toFixed(2),
  };
}

export async function calculateCostCredits(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  discountPercent: number = 0
): Promise<number> {
  await ensureCatalogLoaded();
  const model = MODEL_CATALOG[modelId];
  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const baseInputCredits = (inputTokens / 1_000_000) * model.creditsPerMillionInput;
  const baseOutputCredits = (outputTokens / 1_000_000) * model.creditsPerMillionOutput;
  const base = baseInputCredits + baseOutputCredits;

  const markup = base * (model.markupPercent / 100);
  const grossTotal = base + markup;

  const discount = grossTotal * (discountPercent / 100);
  const netTotal = grossTotal - discount;

  return Math.max(1, Math.ceil(netTotal));
}

export async function getModel(modelId: string): Promise<ModelDef | null> {
  await ensureCatalogLoaded();
  return MODEL_CATALOG[modelId] ?? null;
}

export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateTokensFromWords(wordCount: number): number {
  if (wordCount <= 0) return 1;
  return Math.max(1, Math.ceil(wordCount * 1.3));
}

export async function listModels(): Promise<Array<{
  id: string;
  category: string;
  provider: string;
  inputPricePer1M: number;
  outputPricePer1M: number;
  maxTokens: number;
  contextWindow?: number;
  displayName: string;
  capabilities: string[];
  description: string;
}>> {
  await ensureCatalogLoaded();
  // hasConfiguredProvider: hide models whose providers all lack credentials
  // (e.g. the 87 Venice models on a keyless deploy). Same predicate the
  // router uses before returning 503, so the catalog only advertises what
  // this deploy can actually serve.
  return Object.values(MODEL_CATALOG)
    .filter((m) => m.enabled !== false && hasConfiguredProvider(m))
    .map((m) => ({
      id: m.id,
      category: m.category,
      provider: m.primaryProvider,
      inputPricePer1M: m.inputPricePer1M,
      outputPricePer1M: m.outputPricePer1M,
      // maxTokens stays the conservative default-output-budget field; the
      // true advertised context window is contextWindow (see routes/models.ts).
      maxTokens: m.maxTokens,
      contextWindow: m.contextWindow,
      displayName: m.displayName,
      capabilities: m.capabilities,
      description: m.description,
    }));
}

export async function listVideoModels(): Promise<Array<{
  id: string;
  provider: string;
  price: number;
  duration: string;
  displayName: string;
  capabilities: string[];
  description: string;
}>> {
  await ensureCatalogLoaded();
  // Video models are Venice-only today — hide them all on keyless deploys.
  return Object.values(VIDEO_MODELS)
    .filter((m) => isProviderConfigured(m.provider))
    .map((m) => ({
    id: m.id,
    provider: m.provider,
    price: m.price,
    duration: m.duration,
    displayName: m.displayName,
    capabilities: m.capabilities,
    description: m.description,
  }));
}

export async function listImageModels(): Promise<Array<{
  id: string;
  provider: string;
  pricePerImage: number;
  markupPercent: number;
  displayName: string;
  capabilities: string[];
  description: string;
}>> {
  await ensureCatalogLoaded();
  // Image models are Venice-only today.
  return Object.values(IMAGE_MODELS)
    .filter((m) => m.enabled !== false && isProviderConfigured(m.provider))
    .map((m) => ({
      id: m.id,
      provider: m.provider,
      pricePerImage: m.pricePerImage,
      markupPercent: m.markupPercent,
      displayName: m.displayName,
      capabilities: m.capabilities,
      description: m.description,
    }));
}

export async function getImageModel(id: string): Promise<ImageModelDef | null> {
  await ensureCatalogLoaded();
  return IMAGE_MODELS[id] ?? null;
}

// ---------------------------------------------------------------------------
// New model categories: TTS, Embedding, ASR, Music, Upscale, Inpaint.
// Each follows the same shape as the legacy list* accessors — filtered by
// provider credentials so a keyless deploy never advertises a model that
// would 503 on use.
// ---------------------------------------------------------------------------

export async function listTtsModels(): Promise<Array<{
  id: string;
  provider: string;
  inputPricePer1M: number;
  maxTokens: number;
  markupPercent: number;
  displayName: string;
  capabilities: string[];
  description: string;
}>> {
  await ensureCatalogLoaded();
  return Object.values(TTS_MODELS)
    .filter((m) => m.enabled !== false && isProviderConfigured(m.provider))
    .map((m) => ({
      id: m.id,
      provider: m.provider,
      inputPricePer1M: m.inputPricePer1M,
      maxTokens: m.maxTokens,
      markupPercent: m.markupPercent,
      displayName: m.displayName,
      capabilities: m.capabilities,
      description: m.description,
    }));
}

export async function listEmbeddingModels(): Promise<Array<{
  id: string;
  provider: string;
  inputPricePer1M: number;
  outputPricePer1M: number;
  maxTokens: number;
  markupPercent: number;
  displayName: string;
  capabilities: string[];
  description: string;
}>> {
  await ensureCatalogLoaded();
  return Object.values(EMBEDDING_MODELS)
    .filter((m) => m.enabled !== false && isProviderConfigured(m.provider))
    .map((m) => ({
      id: m.id,
      provider: m.provider,
      inputPricePer1M: m.inputPricePer1M,
      outputPricePer1M: m.outputPricePer1M,
      maxTokens: m.maxTokens,
      markupPercent: m.markupPercent,
      displayName: m.displayName,
      capabilities: m.capabilities,
      description: m.description,
    }));
}

export async function listAsrModels(): Promise<Array<{
  id: string;
  provider: string;
  pricePerSecond: number;
  markupPercent: number;
  displayName: string;
  capabilities: string[];
  description: string;
}>> {
  await ensureCatalogLoaded();
  return Object.values(ASR_MODELS)
    .filter((m) => m.enabled !== false && isProviderConfigured(m.provider))
    .map((m) => ({
      id: m.id,
      provider: m.provider,
      pricePerSecond: m.pricePerSecond,
      markupPercent: m.markupPercent,
      displayName: m.displayName,
      capabilities: m.capabilities,
      description: m.description,
    }));
}

export async function listMusicModels(): Promise<Array<{
  id: string;
  provider: string;
  pricePerGeneration: number;
  markupPercent: number;
  displayName: string;
  capabilities: string[];
  description: string;
}>> {
  await ensureCatalogLoaded();
  return Object.values(MUSIC_MODELS)
    .filter((m) => m.enabled !== false && isProviderConfigured(m.provider))
    .map((m) => ({
      id: m.id,
      provider: m.provider,
      pricePerGeneration: m.pricePerGeneration,
      markupPercent: m.markupPercent,
      displayName: m.displayName,
      capabilities: m.capabilities,
      description: m.description,
    }));
}

export async function listUpscaleModels(): Promise<Array<{
  id: string;
  provider: string;
  pricePerUpscale: number;
  markupPercent: number;
  displayName: string;
  capabilities: string[];
  description: string;
}>> {
  await ensureCatalogLoaded();
  return Object.values(UPSCALE_MODELS)
    .filter((m) => m.enabled !== false && isProviderConfigured(m.provider))
    .map((m) => ({
      id: m.id,
      provider: m.provider,
      pricePerUpscale: m.pricePerUpscale,
      markupPercent: m.markupPercent,
      displayName: m.displayName,
      capabilities: m.capabilities,
      description: m.description,
    }));
}

export async function listInpaintModels(): Promise<Array<{
  id: string;
  provider: string;
  pricePerEdit: number;
  markupPercent: number;
  displayName: string;
  capabilities: string[];
  description: string;
}>> {
  await ensureCatalogLoaded();
  return Object.values(INPAINT_MODELS)
    .filter((m) => m.enabled !== false && isProviderConfigured(m.provider))
    .map((m) => ({
      id: m.id,
      provider: m.provider,
      pricePerEdit: m.pricePerEdit,
      markupPercent: m.markupPercent,
      displayName: m.displayName,
      capabilities: m.capabilities,
      description: m.description,
    }));
}

export async function getTtsModel(id: string): Promise<TtsModelDef | null> {
  await ensureCatalogLoaded();
  return TTS_MODELS[id] ?? null;
}

export async function getEmbeddingModel(id: string): Promise<EmbeddingModelDef | null> {
  await ensureCatalogLoaded();
  return EMBEDDING_MODELS[id] ?? null;
}

export async function getAsrModel(id: string): Promise<AsrModelDef | null> {
  await ensureCatalogLoaded();
  return ASR_MODELS[id] ?? null;
}

export async function getMusicModel(id: string): Promise<MusicModelDef | null> {
  await ensureCatalogLoaded();
  return MUSIC_MODELS[id] ?? null;
}

export async function getUpscaleModel(id: string): Promise<UpscaleModelDef | null> {
  await ensureCatalogLoaded();
  return UPSCALE_MODELS[id] ?? null;
}

export async function getInpaintModel(id: string): Promise<InpaintModelDef | null> {
  await ensureCatalogLoaded();
  return INPAINT_MODELS[id] ?? null;
}

