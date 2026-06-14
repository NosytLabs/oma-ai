/**
 * M10.3 — Model Price Ratio Sync
 *
 * Auto-fetches upstream model prices from Venice, OpenRouter, Together, and
 * DeepInfra, then diffs them against the local MODEL_CATALOG (sourced from
 * `models.json` on disk + loaded into memory by `models.ts::reloadModelCatalog`).
 *
 * Note: OMA does NOT persist models in a Postgres table — the catalog is
 * file-backed (`server/models.json`) and loaded into an in-memory
 * `Record<string, ModelDef>` at boot. The "DB" for the diff is therefore the
 * file; persistence is atomic (write-temp + rename) so a half-written
 * `models.json` never ships to a running process.
 *
 * Per-provider functions are exported individually so the cron job AND the
 * isolated test file can each call them with their own fixtures.
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { reloadModelCatalog, MODEL_CATALOG, type ModelDef } from './models.js';

const RATIO_SYNC_TIMEOUT_MS = 15_000;
/** Treat a price delta below this fraction (0.5%) as a no-op (floating noise). */
const PRICE_DELTA_EPSILON = 0.005;
/** Cap on upstream entries we will inspect per provider (sanity guard). */
const MAX_UPSTREAM_ENTRIES = 10_000;

export interface ParsedPrice {
  /** Upstream model identifier (e.g. `deepseek-v3` for Venice, `openai/gpt-4o-mini` for OpenRouter). */
  upstreamId: string;
  /** Price in USD per 1M input tokens. */
  inputPer1M: number;
  /** Price in USD per 1M output tokens. */
  outputPer1M: number;
}

export interface ProviderSyncResult {
  provider: 'venice' | 'openrouter' | 'together' | 'deepinfra';
  updated: number;
  added: number;
  removed: number;
  errors: number;
  /** Wall-clock duration of the sync in milliseconds. */
  durationMs: number;
}

export interface FullSyncResult {
  venice: ProviderSyncResult;
  openrouter: ProviderSyncResult;
  together: ProviderSyncResult;
  deepinfra: ProviderSyncResult;
  totalUpdated: number;
  totalErrors: number;
}

// ── Parsers (exported for unit testing) ───────────────────────────────────

/**
 * Parse the Venice `/api/v1/models` response.
 *
 * Expected shape (real upstream):
 * ```json
 * {
 *   "data": [
 *     { "id": "deepseek-v3", "pricing": { "inputPricePer1M": 0.50, "outputPricePer1M": 1.50 }, ... }
 *   ]
 * }
 * ```
 * Also tolerates a top-level array, or `pricing` expressed as USD-per-token
 * strings (`"0.0000005"` per token ⇒ 0.50 per 1M).
 */
export function parseVeniceResponse(json: unknown): ParsedPrice[] {
  const arr = extractDataArray(json);
  const out: ParsedPrice[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id : null;
    if (!id) continue;
    const pricing = rec.pricing as Record<string, unknown> | undefined;
    if (!pricing) continue;
    const { input, output } = normalizePerTokenFields(pricing);
    if (input == null || output == null) continue;
    if (!Number.isFinite(input) || !Number.isFinite(output)) continue;
    out.push({
      upstreamId: id,
      inputPer1M: toPer1M(input),
      outputPer1M: toPer1M(output),
    });
  }
  return out.slice(0, MAX_UPSTREAM_ENTRIES);
}

/**
 * Parse the OpenRouter `/api/v1/models` response.
 *
 * Expected shape (real upstream):
 * ```json
 * {
 *   "data": [
 *     { "id": "openai/gpt-4o-mini", "pricing": { "prompt": "0.00015", "completion": "0.0006" } }
 *   ]
 * }
 * ```
 * `prompt` / `completion` are USD per token as strings. Also accepts the
 * camelCase `inputPricePer1M` / `outputPricePer1M` shape for forward-compat.
 */
export function parseOpenRouterResponse(json: unknown): ParsedPrice[] {
  const arr = extractDataArray(json);
  const out: ParsedPrice[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id : null;
    if (!id) continue;
    const pricing = rec.pricing as Record<string, unknown> | undefined;
    if (!pricing) continue;
    // OpenRouter may carry `prompt` (input) and `completion` (output) as USD-per-token strings,
    // or a pre-computed `inputPricePer1M` / `outputPricePer1M` for vendors that publish that way.
    let input: number | null = null;
    let output: number | null = null;
    if (typeof pricing.prompt === 'string' || typeof pricing.prompt === 'number') {
      const v = Number(pricing.prompt);
      if (Number.isFinite(v) && v >= 0) input = v;
    } else if (typeof pricing.inputPricePer1M === 'number') {
      input = pricing.inputPricePer1M / 1_000_000;
    }
    if (typeof pricing.completion === 'string' || typeof pricing.completion === 'number') {
      const v = Number(pricing.completion);
      if (Number.isFinite(v) && v >= 0) output = v;
    } else if (typeof pricing.outputPricePer1M === 'number') {
      output = pricing.outputPricePer1M / 1_000_000;
    }
    if (input == null || output == null) continue;
    out.push({
      upstreamId: id,
      inputPer1M: toPer1M(input),
      outputPer1M: toPer1M(output),
    });
  }
  return out.slice(0, MAX_UPSTREAM_ENTRIES);
}

/**
 * Parse the Together AI `/models` response.
 *
 * Together returns `{ id, pricing: { input, output } }` per model — `input`
 * and `output` are USD per 1M tokens as numbers.
 */
export function parseTogetherResponse(json: unknown): ParsedPrice[] {
  const arr = extractDataArray(json);
  const out: ParsedPrice[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id : null;
    if (!id) continue;
    const pricing = rec.pricing as Record<string, unknown> | undefined;
    if (!pricing) continue;
    const input = pickNumber(pricing.input) ?? pickNumber(pricing.inputPer1M) ?? pickNumber(pricing.input_price);
    const output = pickNumber(pricing.output) ?? pickNumber(pricing.outputPer1M) ?? pickNumber(pricing.output_price);
    if (input == null || output == null) continue;
    out.push({
      upstreamId: id,
      inputPer1M: input,
      outputPer1M: output,
    });
  }
  return out.slice(0, MAX_UPSTREAM_ENTRIES);
}

/**
 * Parse the DeepInfra `/models` response.
 *
 * DeepInfra mirrors the OpenAI /v1/models shape with `pricing.input` /
 * `pricing.output` as USD per 1M tokens (numeric). Some entries use
 * `input_cost_per_token` / `output_cost_per_token` (USD per token).
 */
export function parseDeepInfraResponse(json: unknown): ParsedPrice[] {
  const arr = extractDataArray(json);
  const out: ParsedPrice[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id : null;
    if (!id) continue;
    const pricing = rec.pricing as Record<string, unknown> | undefined;
    if (!pricing) continue;
    // Prefer USD-per-1M direct; fall back to per-token fields (× 1M).
    let input: number | null = null;
    let output: number | null = null;
    if (typeof pricing.input === 'number') {
      input = pricing.input;
    } else if (typeof pricing.input_cost_per_token === 'number') {
      input = pricing.input_cost_per_token * 1_000_000;
    }
    if (typeof pricing.output === 'number') {
      output = pricing.output;
    } else if (typeof pricing.output_cost_per_token === 'number') {
      output = pricing.output_cost_per_token * 1_000_000;
    }
    if (input == null || output == null) continue;
    if (!Number.isFinite(input) || !Number.isFinite(output)) continue;
    out.push({
      upstreamId: id,
      inputPer1M: input,
      outputPer1M: output,
    });
  }
  return out.slice(0, MAX_UPSTREAM_ENTRIES);
}

// ── HTTP fetchers ─────────────────────────────────────────────────────────

export async function fetchVenicePrices(): Promise<ParsedPrice[]> {
  if (!config.VENICE_API_KEY) throw new Error('VENICE_API_KEY not configured');
  const url = joinUrl(config.VENICE_API_URL, '/api/v1/models');
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${config.VENICE_API_KEY}` },
    signal: AbortSignal.timeout(RATIO_SYNC_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`Venice /v1/models returned ${resp.status}`);
  return parseVeniceResponse(await resp.json());
}

export async function fetchOpenRouterPrices(): Promise<ParsedPrice[]> {
  if (!config.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');
  const url = joinUrl(config.OPENROUTER_API_URL, '/api/v1/models');
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${config.OPENROUTER_API_KEY}` },
    signal: AbortSignal.timeout(RATIO_SYNC_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`OpenRouter /v1/models returned ${resp.status}`);
  return parseOpenRouterResponse(await resp.json());
}

export async function fetchTogetherPrices(): Promise<ParsedPrice[]> {
  if (!config.TOGETHER_API_KEY) throw new Error('TOGETHER_API_KEY not configured');
  const url = joinUrl(config.TOGETHER_API_URL, '/models');
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${config.TOGETHER_API_KEY}` },
    signal: AbortSignal.timeout(RATIO_SYNC_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`Together /models returned ${resp.status}`);
  return parseTogetherResponse(await resp.json());
}

export async function fetchDeepInfraPrices(): Promise<ParsedPrice[]> {
  if (!config.DEEPINFRA_API_KEY) throw new Error('DEEPINFRA_API_KEY not configured');
  const url = joinUrl(config.DEEPINFRA_API_URL, '/models');
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${config.DEEPINFRA_API_KEY}` },
    signal: AbortSignal.timeout(RATIO_SYNC_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`DeepInfra /models returned ${resp.status}`);
  return parseDeepInfraResponse(await resp.json());
}

// ── Diff + persist ────────────────────────────────────────────────────────

type ProviderField = 'veniceId' | 'openrouterId' | 'togetherId' | 'deepinfraId';

interface CatalogFile {
  MODEL_CATALOG: Record<string, ModelDef>;
  VIDEO_MODELS?: Record<string, unknown>;
}

function configPath(): string {
  return config.MODELS_CONFIG_PATH || path.join(process.cwd(), 'models.json');
}

/** Read the current on-disk catalog. Falls back to the in-memory catalog if the file is unreadable. */
function readCatalogFile(): CatalogFile {
  const p = configPath();
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as CatalogFile;
    if (!parsed.MODEL_CATALOG || typeof parsed.MODEL_CATALOG !== 'object') {
      throw new Error('models.json missing MODEL_CATALOG object');
    }
    return parsed;
  } catch (err) {
    logger.warn({ path: p, err: (err as Error).message }, '[ratio-sync] read models.json failed; using in-memory snapshot');
    return { MODEL_CATALOG: { ...MODEL_CATALOG } };
  }
}

/** Atomic write: write to `<path>.tmp` then rename. Prevents half-written catalogs. */
function writeCatalogFile(next: CatalogFile): void {
  const p = configPath();
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8');
  fs.renameSync(tmp, p);
}

function pricesDiffer(a: number, b: number): boolean {
  if (a === 0 && b === 0) return false;
  const max = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return Math.abs(a - b) / max > PRICE_DELTA_EPSILON;
}

/**
 * Apply a parsed upstream price list to the in-memory + on-disk catalog.
 * Returns counters describing the diff.
 *
 * - `updated`: local model exists for the upstream id AND prices changed
 * - `added`: upstream id has no matching local model (we DO NOT auto-add; we
 *   only count for visibility — operations team reviews and curates)
 * - `removed`: local model referenced an upstream id that no longer appears
 *   upstream (flag for review; we do NOT auto-delete)
 */
function applyDiff(
  provider: 'venice' | 'openrouter' | 'together' | 'deepinfra',
  upstream: ParsedPrice[],
): { updated: number; added: number; removed: number } {
  const field: ProviderField = (
    provider === 'venice' ? 'veniceId'
    : provider === 'openrouter' ? 'openrouterId'
    : provider === 'together' ? 'togetherId'
    : 'deepinfraId'
  );

  const upstreamById = new Map<string, ParsedPrice>();
  for (const p of upstream) upstreamById.set(p.upstreamId, p);

  let updated = 0;
  let added = 0;
  let removed = 0;

  const nextCatalog = { ...MODEL_CATALOG };
  const matchedLocalKeys = new Set<string>();

  // 1. For each upstream entry, find local models that reference it.
  for (const [upstreamId, price] of upstreamById) {
    const localKey = findLocalKeyForUpstream(field, upstreamId);
    if (!localKey) {
      added += 1;
      continue;
    }
    matchedLocalKeys.add(localKey);
    const existing = nextCatalog[localKey];
    if (!existing) continue;
    if (pricesDiffer(existing.inputPricePer1M, price.inputPer1M)
        || pricesDiffer(existing.outputPricePer1M, price.outputPer1M)) {
      nextCatalog[localKey] = {
        ...existing,
        inputPricePer1M: round4(price.inputPer1M),
        outputPricePer1M: round4(price.outputPer1M),
        // Keep markupPercent, category, etc. — only prices are upstream-controlled.
        creditsPerMillionInput: priceToCredits(price.inputPer1M),
        creditsPerMillionOutput: priceToCredits(price.outputPer1M),
      };
      updated += 1;
    }
  }

  // 2. For each local model that referenced an upstream id we didn't see upstream, count as removed.
  for (const [key, model] of Object.entries(MODEL_CATALOG)) {
    const ref = (model as unknown as Record<string, unknown>)[field];
    if (typeof ref === 'string' && ref.length > 0 && !matchedLocalKeys.has(key) && !upstreamById.has(ref)) {
      removed += 1;
    }
  }

  if (updated > 0) {
    // Persist: write to disk, then reload the in-memory catalog from disk so
    // the running process is consistent with the persisted file.
    const file = readCatalogFile();
    file.MODEL_CATALOG = nextCatalog;
    try {
      writeCatalogFile(file);
      reloadModelCatalog();
    } catch (err) {
      logger.error({ provider, err: (err as Error).message }, '[ratio-sync] persist failed');
      // Roll back our counter — we counted changes we couldn't actually persist.
      throw err;
    }
  }

  return { updated, added, removed };
}

function findLocalKeyForUpstream(field: ProviderField, upstreamId: string): string | null {
  for (const [key, model] of Object.entries(MODEL_CATALOG)) {
    const ref = (model as unknown as Record<string, unknown>)[field];
    if (ref === upstreamId) return key;
  }
  return null;
}

// ── Public sync entry points ──────────────────────────────────────────────

export async function syncVenicePrices(): Promise<ProviderSyncResult> {
  return runProviderSync('venice', fetchVenicePrices, applyDiff);
}

export async function syncOpenRouterPrices(): Promise<ProviderSyncResult> {
  return runProviderSync('openrouter', fetchOpenRouterPrices, applyDiff);
}

export async function syncTogetherPrices(): Promise<ProviderSyncResult> {
  return runProviderSync('together', fetchTogetherPrices, applyDiff);
}

export async function syncDeepInfraPrices(): Promise<ProviderSyncResult> {
  return runProviderSync('deepinfra', fetchDeepInfraPrices, applyDiff);
}

async function runProviderSync(
  provider: 'venice' | 'openrouter' | 'together' | 'deepinfra',
  fetcher: () => Promise<ParsedPrice[]>,
  differ: (p: typeof provider, upstream: ParsedPrice[]) => { updated: number; added: number; removed: number },
): Promise<ProviderSyncResult> {
  const start = Date.now();
  let errors = 0;
  let updated = 0;
  let added = 0;
  let removed = 0;
  try {
    const upstream = await fetcher();
    const diff = differ(provider, upstream);
    updated = diff.updated;
    added = diff.added;
    removed = diff.removed;
  } catch (err) {
    errors = 1;
    logger.warn({ provider, err: (err as Error).message }, '[ratio-sync] provider sync failed');
  }
  const durationMs = Date.now() - start;
  const result: ProviderSyncResult = { provider, updated, added, removed, errors, durationMs };
  logger.info({ provider, updated, added, removed, errors, durationMs, type: 'ratio_sync' }, '[ratio-sync] done');
  return result;
}

/**
 * Run all four provider syncs in parallel. Per-provider failures are isolated;
 * one upstream being down does not block the other three.
 */
export async function runFullSync(): Promise<FullSyncResult> {
  const [venice, openrouter, together, deepinfra] = await Promise.all([
    syncVenicePrices().catch((_err): ProviderSyncResult => ({
      provider: 'venice', updated: 0, added: 0, removed: 0, errors: 1, durationMs: 0,
    })),
    syncOpenRouterPrices().catch((_err): ProviderSyncResult => ({
      provider: 'openrouter', updated: 0, added: 0, removed: 0, errors: 1, durationMs: 0,
    })),
    syncTogetherPrices().catch((_err): ProviderSyncResult => ({
      provider: 'together', updated: 0, added: 0, removed: 0, errors: 1, durationMs: 0,
    })),
    syncDeepInfraPrices().catch((_err): ProviderSyncResult => ({
      provider: 'deepinfra', updated: 0, added: 0, removed: 0, errors: 1, durationMs: 0,
    })),
  ]);
  return {
    venice, openrouter, together, deepinfra,
    totalUpdated: venice.updated + openrouter.updated + together.updated + deepinfra.updated,
    totalErrors: venice.errors + openrouter.errors + together.errors + deepinfra.errors,
  };
}

// ── Helpers (exported for test reuse; not part of the public cron API) ────

export function extractDataArray(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    const rec = json as Record<string, unknown>;
    if (Array.isArray(rec.data)) return rec.data;
    if (Array.isArray(rec.models)) return rec.models;
  }
  return [];
}

export function toPer1M(perToken: number): number {
  if (!Number.isFinite(perToken)) return 0;
  return perToken * 1_000_000;
}

function normalizePerTokenFields(pricing: Record<string, unknown>): { input: number | null; output: number | null } {
  // Accept: inputPer1M/outputPer1M or inputPricePer1M/outputPricePer1M (already per-1M),
  // or per-token input/output.
  let input: number | null = null;
  let output: number | null = null;
  const per1MInput = typeof pricing.inputPer1M === 'number'
    ? pricing.inputPer1M
    : typeof pricing.inputPricePer1M === 'number' ? pricing.inputPricePer1M : null;
  if (per1MInput != null) {
    input = per1MInput / 1_000_000;
  } else if (typeof pricing.input === 'number') {
    input = pricing.input;
  } else if (typeof pricing.input_cost_per_token === 'number') {
    input = pricing.input_cost_per_token;
  }
  const per1MOutput = typeof pricing.outputPer1M === 'number'
    ? pricing.outputPer1M
    : typeof pricing.outputPricePer1M === 'number' ? pricing.outputPricePer1M : null;
  if (per1MOutput != null) {
    output = per1MOutput / 1_000_000;
  } else if (typeof pricing.output === 'number') {
    output = pricing.output;
  } else if (typeof pricing.output_cost_per_token === 'number') {
    output = pricing.output_cost_per_token;
  }
  return { input, output };
}

function pickNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/**
 * Map USD-per-1M to "credits per 1M" using the platform's 100 credits = $1.00
 * convention (i.e. 1 credit = $0.01). With 10% markup applied, the user-facing
 * rate becomes credits * 1.10.
 */
function priceToCredits(usdPer1M: number): number {
  const dollars = usdPer1M;
  const credits = dollars * 100; // $1 = 100 credits
  return Math.round(credits);
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

// Re-exported for test fixtures — never imported by other modules in production.
export const __testing = {
  PRICE_DELTA_EPSILON,
  applyDiff,
  readCatalogFile,
  writeCatalogFile,
  configPath,
};
