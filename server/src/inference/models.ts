import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

export interface ModelDef {
  id: string;
  veniceId?: string;
  antseedId?: string;
  litellmId?: string;
  openrouterId?: string;
  togetherId?: string;
  deepinfraId?: string;
  surplusId?: string;
  provider: "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra" | "surplus" | "both" | "all";
  primaryProvider: "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra" | "surplus";
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

export const WHISPER_MODEL_INFO: ModelDef = {
  id: WHISPER_MODEL,
  veniceId: WHISPER_MODEL,
  provider: "venice",
  primaryProvider: "venice",
  inputPricePer1M: 0,
  outputPricePer1M: 0,
  markupPercent: 10,
  category: "budget",
  maxTokens: 0,
  supportsStreaming: false,
  displayName: "Whisper",
  capabilities: ["audio", "transcription"],
  description: "OpenAI Whisper model for audio transcription",
  creditsPerMillionInput: 0,
  creditsPerMillionOutput: 0,
};

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

export let MODEL_CATALOG: Record<string, ModelDef> = {};
export let VIDEO_MODELS: Record<string, VideoModelDef> = {};

const FALLBACK_MODELS: Record<string, ModelDef> = {
  "deepseek-v3": {
    id: "deepseek-v3",
    veniceId: "deepseek-v3",
    provider: "venice",
    primaryProvider: "venice",
    inputPricePer1M: 0.50,
    outputPricePer1M: 1.50,
    markupPercent: 10,
    category: "premium",
    maxTokens: 65536,
    supportsStreaming: true,
    displayName: "DeepSeek V3",
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
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    openrouterId: "gpt-4o-mini",
    provider: "openrouter",
    primaryProvider: "openrouter",
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.60,
    markupPercent: 10,
    category: "mid",
    maxTokens: 128000,
    supportsStreaming: true,
    displayName: "GPT-4o Mini",
    capabilities: ["chat", "code", "reasoning"],
    description: "OpenAI's cost-efficient model",
    creditsPerMillionInput: 150,
    creditsPerMillionOutput: 600,
  },
  "llama-3.3-70b-together": {
    id: "llama-3.3-70b-together",
    togetherId: "llama-3.3-70b-together",
    provider: "together",
    primaryProvider: "together",
    inputPricePer1M: 0.35,
    outputPricePer1M: 0.90,
    markupPercent: 10,
    category: "premium",
    maxTokens: 8192,
    supportsStreaming: true,
    displayName: "Llama 3.3 70B (Together)",
    capabilities: ["chat", "code"],
    description: "Meta's 70B on Together AI",
    creditsPerMillionInput: 350,
    creditsPerMillionOutput: 900,
  },
  "free/gpt-3.5-turbo": {
    id: "free/gpt-3.5-turbo",
    openrouterId: "openai/gpt-3.5-turbo",
    provider: "openrouter",
    primaryProvider: "openrouter",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    markupPercent: 0,
    category: "budget",
    maxTokens: 16385,
    supportsStreaming: true,
    displayName: "GPT-3.5 Turbo (FREE)",
    capabilities: ["chat", "code"],
    description: "Free tier - OpenAI GPT-3.5 Turbo with rate limits",
    creditsPerMillionInput: 0,
    creditsPerMillionOutput: 0,
  },
  "free/claude-3-haiku": {
    id: "free/claude-3-haiku",
    openrouterId: "anthropic/claude-3-haiku",
    provider: "openrouter",
    primaryProvider: "openrouter",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    markupPercent: 0,
    category: "budget",
    maxTokens: 200000,
    supportsStreaming: true,
    displayName: "Claude 3 Haiku (FREE)",
    capabilities: ["chat", "code", "fast"],
    description: "Free tier - Anthropic Claude 3 Haiku",
    creditsPerMillionInput: 0,
    creditsPerMillionOutput: 0,
  },
  "free/gemini-pro": {
    id: "free/gemini-pro",
    openrouterId: "google/gemini-pro",
    provider: "openrouter",
    primaryProvider: "openrouter",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    markupPercent: 0,
    category: "budget",
    maxTokens: 32768,
    supportsStreaming: true,
    displayName: "Gemini Pro (FREE)",
    capabilities: ["chat", "code", "vision"],
    description: "Free tier - Google Gemini Pro",
    creditsPerMillionInput: 0,
    creditsPerMillionOutput: 0,
  },
  "free/llama-3-8b": {
    id: "free/llama-3-8b",
    openrouterId: "meta-llama/llama-3-8b-instruct",
    provider: "openrouter",
    primaryProvider: "openrouter",
    inputPricePer1M: 0,
    outputPricePer1M: 0,
    markupPercent: 0,
    category: "budget",
    maxTokens: 8192,
    supportsStreaming: true,
    displayName: "Llama 3 8B (FREE)",
    capabilities: ["chat", "code"],
    description: "Free tier - Meta Llama 3 8B",
    creditsPerMillionInput: 0,
    creditsPerMillionOutput: 0,
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
  try {
    const data = await fs.promises.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(data);
    MODEL_CATALOG = parsed.MODEL_CATALOG || FALLBACK_MODELS;
    VIDEO_MODELS = parsed.VIDEO_MODELS || FALLBACK_VIDEO_MODELS;
    logger.info({ modelCount: Object.keys(MODEL_CATALOG).length, videoModelCount: Object.keys(VIDEO_MODELS).length, configPath, type: 'model_catalog_loaded' });
  } catch (error) {
    logger.warn({ configPath, error: error instanceof Error ? error.message : String(error), type: 'model_catalog_fallback' }, 'Failed to load models.json, using fallback models');
    MODEL_CATALOG = FALLBACK_MODELS;
    VIDEO_MODELS = FALLBACK_VIDEO_MODELS;
  }
}

export async function getModelCatalog(): Promise<Record<string, ModelDef>> {
  await ensureCatalogLoaded();
  return MODEL_CATALOG;
}

export async function getVideoModels(): Promise<Record<string, VideoModelDef>> {
  await ensureCatalogLoaded();
  return VIDEO_MODELS;
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