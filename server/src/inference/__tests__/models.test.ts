import { describe, it, expect } from 'vitest'
import {
  getModel,
  calculateCost,
  calculateCostCredits,
  estimateTokens,
  estimateTokensFromWords,
  listModels,
  ensureCatalogLoaded,
  detectPriceDrift,
} from '../models.js'

describe('models', () => {
  describe('getModel', () => {
    it('returns null for unknown model', async () => {
      await ensureCatalogLoaded()
      const result = await getModel('nonexistent-model')
      expect(result).toBeNull()
    })

    it('returns model def for known model from catalog', async () => {
      await ensureCatalogLoaded()
      const result = await getModel('deepseek-v3.2')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('deepseek-v3.2')
    })
  })

  describe('calculateCost', () => {
    it('throws for unknown model', async () => {
      await ensureCatalogLoaded()
      await expect(calculateCost('nonexistent-model', 100, 50)).rejects.toThrow('Unknown model')
    })
  })

  describe('calculateCostCredits', () => {
    it('throws for unknown model', async () => {
      await ensureCatalogLoaded()
      await expect(calculateCostCredits('nonexistent-model', 100, 50)).rejects.toThrow('Unknown model')
    })
  })

  describe('estimateTokens', () => {
    it('counts tokens from text', () => {
      const tokens = estimateTokens('hello world')
      expect(tokens).toBeGreaterThanOrEqual(1)
    })

    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })
  })

  describe('estimateTokensFromWords', () => {
    it('converts word count to tokens', () => {
      const tokens = estimateTokensFromWords(10)
      expect(tokens).toBe(13)
    })

    it('returns minimum 1 for zero or negative count', () => {
      expect(estimateTokensFromWords(0)).toBe(1)
    })
  })

  describe('listModels', () => {
    it('returns array of models with expected fields', async () => {
      const models = await listModels()
      expect(Array.isArray(models)).toBe(true)
      if (models.length > 0) {
        const model = models[0]
        expect(model).toHaveProperty('id')
        expect(model).toHaveProperty('category')
        expect(model).toHaveProperty('inputPricePer1M')
        expect(model).toHaveProperty('outputPricePer1M')
        expect(model).toHaveProperty('maxTokens')
        expect(model).toHaveProperty('displayName')
        expect(model).toHaveProperty('capabilities')
        expect(model).toHaveProperty('description')
      }
    })

    // Catalog gating: the test env has no VENICE_API_KEY (see vitest.setup.ts),
    // so Venice counts as unconfigured — the same predicate that makes the
    // router 503 must also hide those models from the advertised catalog.
    it('hides models whose providers all lack credentials (keyless deploy)', async () => {
      const models = await listModels()
      expect(models.some((m) => m.provider === 'venice')).toBe(false)
    })

    it('still advertises keyless-capable Gonka models on a keyless deploy', async () => {
      const models = await listModels()
      const gonkaModels = models.filter((m) => m.provider === 'gonka')
      expect(gonkaModels.length).toBeGreaterThan(0)
      expect(models.length).toBe(gonkaModels.length)
    })
  })

  // detectPriceDrift gates revenue decisions: it must flag catalog entries whose
  // actual markupPercent is BELOW the operator-expected floor. Tested defensively
  // per independent review (revenue-gating logic deserves coverage).
  describe('detectPriceDrift', () => {
    const catalog = {
      'model-a': { markupPercent: 10 } as any,
      'model-b': { markupPercent: 50 } as any,
      'model-c': { markupPercent: 0 } as any,
    }

    it('returns empty when no expected overrides', () => {
      expect(detectPriceDrift(catalog, {})).toEqual([])
    })

    it('flags models below their expected floor', () => {
      const drift = detectPriceDrift(catalog, { 'model-a': 25, 'model-b': 40 })
      expect(drift).toHaveLength(1)
      expect(drift[0]).toMatchObject({ id: 'model-a', expected: 25, actual: 10 })
    })

    it('does not flag models at or above the floor', () => {
      expect(detectPriceDrift(catalog, { 'model-b': 40, 'model-c': 0 })).toEqual([])
    })

    it('treats missing catalog entries as 0 actual (always drift if floor > 0)', () => {
      const drift = detectPriceDrift(catalog, { 'model-z': 10 })
      expect(drift).toHaveLength(1)
      expect(drift[0]).toMatchObject({ id: 'model-z', expected: 10, actual: 0 })
    })

    it('never throws on null/undefined inputs', () => {
      expect(detectPriceDrift(null as any, { 'model-a': 10 })).toEqual([])
      expect(detectPriceDrift(catalog, null as any)).toEqual([])
    })
  })
})