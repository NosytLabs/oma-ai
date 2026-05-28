import { describe, it, expect } from 'vitest'
import {
  getModel,
  calculateCost,
  calculateCostCredits,
  estimateTokens,
  estimateTokensFromWords,
  listModels,
  ensureCatalogLoaded,
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
      const result = await getModel('deepseek-v3')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('deepseek-v3')
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
  })
})