/**
 * ISOLATED Unit Test for server/src/inference/ratio-sync.ts
 *
 * Target: server/src/inference/ratio-sync.ts
 * Session: ses_m10_3_ratio_sync
 *
 * This file is the ISOLATED test for M10.3 — it tests ONLY the ratio-sync
 * module's public functions (parseVeniceResponse, parseOpenRouterResponse,
 * applyDiff), mocking all I/O (fs.readFileSync, fs.writeFileSync, fetch).
 *
 * WARNING: this file will be DELETED after the test passes. The test code
 * is preserved verbatim in .opencode/unit-tests/2026-06-14T05-00Z-m10-3-ratio-sync.md.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependencies BEFORE importing the target module.
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
  },
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

vi.mock('../config.js', () => ({
  config: {
    VENICE_API_KEY: 'test-venice-key',
    OPENROUTER_API_KEY: 'test-openrouter-key',
    TOGETHER_API_KEY: 'test-together-key',
    DEEPINFRA_API_KEY: 'test-deepinfra-key',
    VENICE_API_URL: 'https://api.venice.test',
    OPENROUTER_API_URL: 'https://openrouter.test/api/v1',
    TOGETHER_API_URL: 'https://api.together.test',
    DEEPINFRA_API_URL: 'https://api.deepinfra.test',
    MODELS_CONFIG_PATH: '/tmp/ratio-sync-test-models.json',
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../inference/models.js', async () => {
  // We cannot use `...actual` here because that would snapshot MODEL_CATALOG
  // at mock-registration time and break the live binding for tests that
  // install a fixture via `__setModelCatalog`. Instead we forward everything
  // via a Proxy that delegates to the real module on every property access.
  const actual = await vi.importActual<typeof import('../inference/models.js')>('../inference/models.js');
  const handler: ProxyHandler<typeof actual> = {
    get(_t, prop) {
      return Reflect.get(actual, prop);
    },
  };
  return new Proxy(actual, handler) as typeof actual;
});

import * as fs from 'fs';
import * as models from '../inference/models.js';
import {
  parseVeniceResponse,
  parseOpenRouterResponse,
  parseTogetherResponse,
  parseDeepInfraResponse,
  __testing,
} from '../inference/ratio-sync.js';

const mockedFs = fs as unknown as {
  readFileSync: ReturnType<typeof vi.fn>;
  writeFileSync: ReturnType<typeof vi.fn>;
  renameSync: ReturnType<typeof vi.fn>;
};

// Spy on the real reloadModelCatalog so we can verify calls without going
// through the full disk read path. The Proxy mock above keeps MODEL_CATALOG
// live-bound to the real module so __setModelCatalog() updates propagate.
let reloadSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  reloadSpy = vi.spyOn(models, 'reloadModelCatalog').mockImplementation(() => Promise.resolve());
});

// ── Test 1: parseVeniceResponse ───────────────────────────────────────────

describe('parseVeniceResponse', () => {
  it('parses a real Venice /api/v1/models response shape', () => {
    // Real Venice response shape — fixture taken from Venice docs / observed
    // production traffic (deepseek-v3, llama-3.3-70b).
    const fixture = {
      data: [
        {
          id: 'deepseek-v3',
          name: 'DeepSeek V3',
          pricing: {
            inputPricePer1M: 0.5,
            outputPricePer1M: 1.5,
          },
        },
        {
          id: 'llama-3.3-70b',
          name: 'Llama 3.3 70B',
          pricing: {
            inputPricePer1M: 0.88,
            outputPricePer1M: 0.88,
          },
        },
        {
          id: 'qwen-2.5-72b',
          name: 'Qwen 2.5 72B',
          // Missing pricing — should be skipped
        },
      ],
    };

    const result = parseVeniceResponse(fixture);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      upstreamId: 'deepseek-v3',
      inputPer1M: 0.5,
      outputPer1M: 1.5,
    });
    expect(result[1].upstreamId).toBe('llama-3.3-70b');
    expect(result[1].inputPer1M).toBeCloseTo(0.88, 6);
    expect(result[1].outputPer1M).toBeCloseTo(0.88, 6);
  });

  it('tolerates a top-level array (no `data` wrapper)', () => {
    const fixture = [
      { id: 'a', pricing: { input: 0.000001, output: 0.000002 } }, // per-token
      { id: 'b' }, // missing pricing
    ];
    const result = parseVeniceResponse(fixture);
    expect(result).toHaveLength(1);
    expect(result[0].upstreamId).toBe('a');
    expect(result[0].inputPer1M).toBeCloseTo(1.0, 6); // 0.000001 * 1M
    expect(result[0].outputPer1M).toBeCloseTo(2.0, 6);
  });
});

// ── Test 2: parseOpenRouterResponse ───────────────────────────────────────

describe('parseOpenRouterResponse', () => {
  it('parses a real OpenRouter /api/v1/models response shape', () => {
    // Real OpenRouter response shape — fixture taken from OpenRouter docs.
    // `prompt` and `completion` are USD per token as STRINGS.
    // $0.15 / 1M = $0.00000015 per token → prompt = "0.00000015"
    // $0.60 / 1M = $0.0000006 per token  → completion = "0.0000006"
    const fixture = {
      data: [
        {
          id: 'openai/gpt-4o-mini',
          name: 'GPT-4o Mini',
          pricing: {
            prompt: '0.00000015',
            completion: '0.0000006',
            request: '0',
            image: '0',
          },
        },
        {
          id: 'anthropic/claude-3-haiku',
          name: 'Claude 3 Haiku',
          pricing: {
            prompt: '0.00000025',
            completion: '0.00000125',
          },
        },
        {
          id: 'meta-llama/llama-3-70b-instruct',
          name: 'Llama 3 70B (no pricing)',
          // Skipped
        },
      ],
    };

    const result = parseOpenRouterResponse(fixture);

    expect(result).toHaveLength(2);
    expect(result[0].upstreamId).toBe('openai/gpt-4o-mini');
    expect(result[0].inputPer1M).toBeCloseTo(0.15, 6); // 0.00015 * 1M
    expect(result[0].outputPer1M).toBeCloseTo(0.6, 6); // 0.0006 * 1M
    expect(result[1].upstreamId).toBe('anthropic/claude-3-haiku');
    expect(result[1].inputPer1M).toBeCloseTo(0.25, 6);
    expect(result[1].outputPer1M).toBeCloseTo(1.25, 6);
  });

  it('returns empty array for empty data', () => {
    expect(parseOpenRouterResponse({ data: [] })).toEqual([]);
    expect(parseOpenRouterResponse([])).toEqual([]);
    expect(parseOpenRouterResponse(null)).toEqual([]);
    expect(parseOpenRouterResponse('not-an-object')).toEqual([]);
  });
});

// ── Test 3: applyDiff only modifies changed rows ──────────────────────────

describe('applyDiff', () => {
  it('only counts entries whose prices actually changed (epsilon-aware)', () => {
    // Pre-populate MODEL_CATALOG with three references:
    //   - changed: upstream price differs from local
    //   - unchanged: upstream price matches local within epsilon
    //   - added: upstream has no matching local reference (counts as `added`)
    //   - removed: local has reference to upstream id that no longer appears
    models.__setModelCatalog({
      'changed-model': {
        id: 'changed-model',
        veniceId: 'venice-changed',
        inputPricePer1M: 0.5,
        outputPricePer1M: 1.0,
        markupPercent: 10,
        category: 'mid',
        maxTokens: 8192,
        supportsStreaming: true,
        displayName: 'Changed',
        capabilities: [],
        description: '',
        creditsPerMillionInput: 50,
        creditsPerMillionOutput: 100,
        primaryProvider: 'venice',
        provider: 'venice',
      },
      'unchanged-model': {
        id: 'unchanged-model',
        veniceId: 'venice-unchanged',
        inputPricePer1M: 0.30,
        outputPricePer1M: 0.60,
        markupPercent: 10,
        category: 'mid',
        maxTokens: 8192,
        supportsStreaming: true,
        displayName: 'Unchanged',
        capabilities: [],
        description: '',
        creditsPerMillionInput: 30,
        creditsPerMillionOutput: 60,
        primaryProvider: 'venice',
        provider: 'venice',
      },
      'orphan-model': {
        id: 'orphan-model',
        veniceId: 'venice-gone',
        inputPricePer1M: 0.99,
        outputPricePer1M: 1.99,
        markupPercent: 10,
        category: 'mid',
        maxTokens: 8192,
        supportsStreaming: true,
        displayName: 'Orphan',
        capabilities: [],
        description: '',
        creditsPerMillionInput: 99,
        creditsPerMillionOutput: 199,
        primaryProvider: 'venice',
        provider: 'venice',
      },
    });

    // Upstream: changed price, same price (within epsilon), new model
    const upstream = [
      // Changed: 0.5 → 0.75 (50% delta, well over 0.5% epsilon)
      { upstreamId: 'venice-changed', inputPer1M: 0.75, outputPer1M: 1.10 },
      // Unchanged: 0.30 vs 0.3001 (0.033% delta, under 0.5% epsilon)
      { upstreamId: 'venice-unchanged', inputPer1M: 0.3001, outputPer1M: 0.5999 },
      // No match in local catalog → counted as `added`
      { upstreamId: 'venice-fresh', inputPer1M: 0.01, outputPer1M: 0.02 },
      // venice-gone intentionally missing from upstream → counted as `removed`
    ];

    // Mock the persistence layer so applyDiff can succeed without touching disk.
    mockedFs.readFileSync.mockReturnValue(JSON.stringify({
      MODEL_CATALOG: models.MODEL_CATALOG,
    }));
    mockedFs.writeFileSync.mockImplementation(() => undefined);
    mockedFs.renameSync.mockImplementation(() => undefined);

    const result = __testing.applyDiff('venice', upstream);

    expect(result.updated).toBe(1); // only venice-changed
    expect(result.added).toBe(1); // venice-fresh
    expect(result.removed).toBe(1); // venice-gone

    // Only ONE model.json write should have happened (the one updated entry)
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
    // The write should contain the new prices for venice-changed only.
    const written = JSON.parse(mockedFs.writeFileSync.mock.calls[0][1] as string);
    expect(written.MODEL_CATALOG['changed-model'].inputPricePer1M).toBe(0.75);
    expect(written.MODEL_CATALOG['changed-model'].outputPricePer1M).toBe(1.10);
    // Unchanged row is byte-identical (proves diff-then-update did not over-write)
    expect(written.MODEL_CATALOG['unchanged-model'].inputPricePer1M).toBe(0.30);
    expect(written.MODEL_CATALOG['unchanged-model'].outputPricePer1M).toBe(0.60);
    // Orphan row is also untouched
    expect(written.MODEL_CATALOG['orphan-model'].inputPricePer1M).toBe(0.99);

    // reloadModelCatalog was called exactly once (after the single write)
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not write to disk when nothing changed', () => {
    models.__setModelCatalog({
      'same': {
        id: 'same',
        veniceId: 'venice-same',
        inputPricePer1M: 0.20,
        outputPricePer1M: 0.40,
        markupPercent: 10,
        category: 'budget',
        maxTokens: 8192,
        supportsStreaming: true,
        displayName: 'Same',
        capabilities: ['chat'],
        description: '',
        creditsPerMillionInput: 20,
        creditsPerMillionOutput: 40,
        primaryProvider: 'venice',
        provider: 'venice',
      },
    });
    const upstream = [
      { upstreamId: 'venice-same', inputPer1M: 0.20, outputPer1M: 0.40 },
    ];
    const result = __testing.applyDiff('venice', upstream);
    expect(result.updated).toBe(0);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});

// ── Test 4 (bonus): parseTogetherResponse and parseDeepInfraResponse ──────

describe('parseTogetherResponse and parseDeepInfraResponse', () => {
  it('parses Together /models response (per-1M numeric)', () => {
    const fixture = {
      data: [
        { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', pricing: { input: 0.88, output: 0.88 } },
        { id: 'no-pricing' },
      ],
    };
    const result = parseTogetherResponse(fixture);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      upstreamId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      inputPer1M: 0.88,
      outputPer1M: 0.88,
    });
  });

  it('parses DeepInfra /models response (per-token field fallback)', () => {
    const fixture = {
      data: [
        {
          id: 'meta-llama/Llama-3.3-70B-Instruct',
          pricing: { input_cost_per_token: 0.00000072, output_cost_per_token: 0.00000072 },
        },
      ],
    };
    const result = parseDeepInfraResponse(fixture);
    expect(result).toHaveLength(1);
    expect(result[0].inputPer1M).toBeCloseTo(0.72, 6);
    expect(result[0].outputPer1M).toBeCloseTo(0.72, 6);
  });
});
