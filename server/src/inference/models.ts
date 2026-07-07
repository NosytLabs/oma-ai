import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

export interface ModelDef {
  id: string;
  veniceId?: string;
  surplusId?: string;
  provider: "venice" | "surplus" | "both" | "all";
  primaryProvider: "venice" | "surplus";
  inputPricePer1M: number;
  outputPricePer1M: number;
  markupPercent: number;
  category: "budget" | "mid" | "premium" | "frontier";
  maxTokens: number;
  supportsStreaming: boolean;
  displayName: string;
  capabilities: string[];
  description: string;
  creditsPerMillionInput: number;
  creditsPerMillionOutput: number;
}

export const WHISPER_MODEL = "whisper-1";

export interface VideoModelDef {
  id: string;
  provider: "venice";
  price: number;
  duration: string;
  displayName: string;
  capabilities: string[];
  description: string;
  creditsPerMillionInput: number;
  creditsPerMillionOutput: number;
  creditsPrice: number;
}

let MODEL_CATALOG: Record<string, ModelDef> = {};
export let VIDEO_MODELS: Record<string, VideoModelDef> = {};

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
    loadedFromDisk = parsed.MODEL_CATALOG !== undefined;
    logger.info({
      modelCount: Object.keys(MODEL_CATALOG).length,
      videoModelCount: Object.keys(VIDEO_MODELS).length,
      configPath,
      source: loadedFromDisk ? 'models.json' : 'fallback',
      type: 'model_catalog_loaded'
    });
  } catch (error) {
    logger.warn({ configPath, error: error instanceof Error ? error.message : String(error), type: 'model_catalog_fallback' }, 'Failed to load models.json, using fallback models');
    MODEL_CATALOG = FALLBACK_MODELS;
    VIDEO_MODELS = FALLBACK_VIDEO_MODELS;
  }
  // Audit the catalog AFTER both success and failure paths so operators
  // see the same warnings no matter which catalog got loaded.
  auditMarkupSanity(MODEL_CATALOG);
  runExpectedMarkupAudit(MODEL_CATALOG);
}

/**
 * Emits a WARN for every model whose `markupPercent` is missing or <= 0.
 * Selling Venice compute at 0% markup = direct revenue leak. Operators see
 * the warning once per process (not per request) at startup.
 */
function auditMarkupSanity(catalog: Record<string, ModelDef>): void {
  if (!catalog) return;
  const offenders: Array<{ id: string; markupPercent: number }> = [];
  for (const [id, def] of Object.entries(catalog)) {
    if (!Number.isFinite(def?.markupPercent) || def.markupPercent <= 0) {
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

  const costCents = Math.ceil(baseCost * 100).toString();
  const markupCents = Math.ceil(markup * 100).toString();
  const totalCents = Math.max(1, Math.ceil(netTotal * 100)).toString();

  return { costCents, markupCents, totalCents };
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
  inputPricePer1M: number;
  outputPricePer1M: number;
  maxTokens: number;
  displayName: string;
  capabilities: string[];
  description: string;
}>> {
  await ensureCatalogLoaded();
  return Object.values(MODEL_CATALOG).map((m) => ({
    id: m.id,
    category: m.category,
    inputPricePer1M: m.inputPricePer1M,
    outputPricePer1M: m.outputPricePer1M,
    maxTokens: m.maxTokens,
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
  return Object.values(VIDEO_MODELS).map((m) => ({
    id: m.id,
    provider: m.provider,
    price: m.price,
    duration: m.duration,
    displayName: m.displayName,
    capabilities: m.capabilities,
    description: m.description,
  }));
}

