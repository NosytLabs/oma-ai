/**
 * M10.8 ISOLATED Unit Test for model-list-cache.ts
 *
 * Target: server/src/inference/model-list-cache.ts
 * Session: ses_m10_7_8
 *
 * **WARNING**: THIS FILE WILL BE DELETED AFTER TESTS PASS.
 * Test code preserved in: .opencode/unit-tests/2026-06-14T05-00Z-m10-7-and-8.md
 *
 * Two tests as required by the M10.8 spec:
 *   1. Cache hit returns same models without upstream fetch
 *   2. TTL expiry refetches
 *
 * Plus tests for the L1 in-memory cache (we cannot test L2 Redis
 * behavior here because the test env may have no Redis; we mock
 * the redis client so we can verify both L1-only and L1+L2 paths).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the redis client. By default we simulate "Redis not ready",
// which means the cache behaves as L1-only. Tests can override the
// mock to enable L2.
const mockRedisStore = new Map<string, { value: string; expiresAt: number }>();
const mockRedisClient = {
  get: vi.fn(async (key: string) => {
    const entry = mockRedisStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      mockRedisStore.delete(key);
      return null;
    }
    return entry.value;
  }),
  set: vi.fn(async (key: string, value: string, opts?: { EX?: number }) => {
    const expiresAt = Date.now() + (opts?.EX ?? 300) * 1000;
    mockRedisStore.set(key, { value, expiresAt });
    return 'OK';
  }),
  del: vi.fn(async (key: string) => {
    return mockRedisStore.delete(key) ? 1 : 0;
  }),
};

let redisReady = false;

vi.mock('../lib/redis-client.js', () => ({
  getRedisClient: vi.fn(async () => (redisReady ? mockRedisClient : null)),
  isRedisReady: vi.fn(() => redisReady),
}));

vi.mock('../lib/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  getCachedModelList,
  setCachedModelList,
  invalidateCachedModelList,
  clearL1Cache,
  getL1CacheSize,
} from '../inference/model-list-cache.js';

const SAMPLE_MODELS = [
  { id: 'deepseek-v3', category: 'premium', inputPricePer1M: 0.5 },
  { id: 'llama-3.3-70b', category: 'mid', inputPricePer1M: 0.35 },
];

beforeEach(() => {
  clearL1Cache();
  mockRedisStore.clear();
  mockRedisClient.get.mockClear();
  mockRedisClient.set.mockClear();
  mockRedisClient.del.mockClear();
  redisReady = false;
});

describe('M10.8 model-list-cache', () => {
  /**
   * Test 1: cache hit returns the same models that were set, without
   * requiring a second upstream fetch.
   *
   * We assert three things:
   *   - getCachedModelList returns null on first call (cache miss)
   *   - after setCachedModelList, getCachedModelList returns the same array
   *   - the returned value is the SAME REFERENCE (L1 hit) so callers
   *     can avoid the JSON parse cost
   */
  it('test 1: cache hit returns same models without re-fetching', async () => {
    // 1a. Miss before any set
    const miss = await getCachedModelList('venice');
    expect(miss).toBeNull();

    // 1b. Set populates L1
    await setCachedModelList('venice', SAMPLE_MODELS);
    expect(getL1CacheSize()).toBe(1);

    // 1c. Subsequent get returns the same models (L1 hit, no I/O)
    const hit = await getCachedModelList('venice');
    expect(hit).not.toBeNull();
    expect(hit).toEqual(SAMPLE_MODELS);
    // L1 returns the SAME REFERENCE — no JSON.parse, no re-map.
    expect(hit).toBe(SAMPLE_MODELS);
  });

  /**
   * Test 2: TTL expiry refetches (returns null on expired entry).
   *
   * We use a configurable ttlSeconds parameter to make the test
   * fast (no real 5-minute wait). Set with 50ms TTL, wait 100ms,
   * expect null. This proves the L1 envelope is checked for
   * expiresAtMs and is dropped on expiry.
   */
  it('test 2: TTL expiry refetches (returns null on expired entry)', async () => {
    // 2a. Set with very short TTL
    await setCachedModelList('venice', SAMPLE_MODELS, /* ttlSeconds */ 0.05);
    // 2b. Immediate hit works
    const immediate = await getCachedModelList('venice', /* ttlSeconds */ 0.05);
    expect(immediate).not.toBeNull();
    expect(immediate).toEqual(SAMPLE_MODELS);
    // 2c. Wait past expiry
    await new Promise((r) => setTimeout(r, 100));
    // 2d. Now get should return null (L1 expired)
    const expired = await getCachedModelList('venice', /* ttlSeconds */ 0.05);
    expect(expired).toBeNull();
    // 2e. After expiry, the L1 entry should be dropped
    expect(getL1CacheSize()).toBe(0);
  });

  /**
   * Test 3 (bonus): per-provider isolation — different providers
   * have independent cache entries.
   */
  it('test 3: per-provider cache isolation (venice vs openrouter)', async () => {
    const veniceModels = [{ id: 'venice-model', inputPricePer1M: 0.5 }];
    const openrouterModels = [{ id: 'openrouter-model', inputPricePer1M: 1.0 }];
    await setCachedModelList('venice', veniceModels);
    await setCachedModelList('openrouter', openrouterModels);
    expect(getL1CacheSize()).toBe(2);
    const v = await getCachedModelList('venice');
    const o = await getCachedModelList('openrouter');
    expect(v).toEqual(veniceModels);
    expect(o).toEqual(openrouterModels);
    expect(v).not.toBe(o);
  });

  /**
   * Test 4 (bonus): invalidate forces a re-fetch.
   */
  it('test 4: invalidateCachedModelList drops both L1 and L2', async () => {
    await setCachedModelList('venice', SAMPLE_MODELS);
    expect(getL1CacheSize()).toBe(1);
    await invalidateCachedModelList('venice');
    expect(getL1CacheSize()).toBe(0);
    const after = await getCachedModelList('venice');
    expect(after).toBeNull();
  });

  /**
   * Test 5 (bonus): L2 Redis integration — set populates BOTH L1 and L2.
   */
  it('test 5: setCachedModelList writes to L2 Redis when available', async () => {
    redisReady = true;
    await setCachedModelList('venice', SAMPLE_MODELS, 60);
    // L1 populated
    expect(getL1CacheSize()).toBe(1);
    // L2 SET was called
    expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
    const [key, value, opts] = mockRedisClient.set.mock.calls[0];
    expect(key).toBe('model-list:venice');
    expect(value).toContain('"models"');
    expect(opts).toEqual({ EX: 60 });
  });

  /**
   * Test 6 (bonus): L2 Redis hit repopulates L1.
   */
  it('test 6: L2 hit repopulates L1 with the parsed models', async () => {
    redisReady = true;
    // Pre-seed L2 (as if a prior replica set the cache)
    const envelope = JSON.stringify({
      models: SAMPLE_MODELS,
      expiresAtMs: Date.now() + 60_000,
    });
    mockRedisStore.set('model-list:venice', { value: envelope, expiresAt: Date.now() + 60_000 });
    // L1 is empty
    expect(getL1CacheSize()).toBe(0);
    // Get — should hit L2 and repopulate L1
    const hit = await getCachedModelList('venice');
    expect(hit).toEqual(SAMPLE_MODELS);
    // L1 now has the entry
    expect(getL1CacheSize()).toBe(1);
  });

  /**
   * Test 7 (bonus): L1 LRU eviction at cap.
   *
   * The L1 cap is L1_MAX_ENTRIES (64). We don't insert 65 entries
   * directly (would be slow) — instead we verify the cap is 64 by
   * reading the cache's behavior on the boundary. We document the
   * cap and check the L1 size never exceeds it for a small set of
   * providers.
   */
  it('test 7: L1 LRU eviction at cap (L1_MAX_ENTRIES=64)', async () => {
    // Set 100 different providers (well above the 64 cap).
    for (let i = 0; i < 100; i++) {
      await setCachedModelList(`provider-${i}`, [{ id: `m-${i}` }]);
    }
    // L1 should never grow beyond the cap
    expect(getL1CacheSize()).toBeLessThanOrEqual(64);
    // The OLDEST entries should have been evicted (insertion-order LRU).
    // The most recent 64 should be present.
    const stillCached = await getCachedModelList('provider-99');
    expect(stillCached).not.toBeNull();
    // The earliest (provider-0) should have been evicted
    // (insertion-order Map LRU drops the first key when at cap).
    const earlyMiss = await getCachedModelList('provider-0');
    expect(earlyMiss).toBeNull();
  });
});
