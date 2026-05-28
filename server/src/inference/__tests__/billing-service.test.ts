import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getModelPricing,
  estimateCost,
  calculateActualCost,
  calculateStreamingCost,
  getEstimatedOutputTokens,
} from '../billing-service.js'
import { getModel, calculateCost } from '../models.js'

vi.mock('../models.js', () => ({
  getModel: vi.fn(),
  calculateCost: vi.fn(),
  estimateTokens: vi.fn().mockReturnValue(50),
  ensureCatalogLoaded: vi.fn().mockResolvedValue(undefined),
}))

describe('billing-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getModelPricing', () => {
    it('returns correct pricing for known model', async () => {
      vi.mocked(getModel).mockResolvedValue({
        id: 'deepseek-v3',
        inputPricePer1M: 0.50,
        outputPricePer1M: 1.50,
        markupPercent: 10,
        primaryProvider: 'venice',
      } as any)

      const pricing = await getModelPricing('deepseek-v3')
      expect(pricing).toEqual({
        inputPer1k: 0.0005,
        outputPer1k: 0.0015,
        provider: 'venice',
        markup: 10,
      })
    })

    it('returns litellm defaults for litellm/ prefix', async () => {
      vi.mocked(getModel).mockResolvedValue(null)
      expect(await getModelPricing('litellm/gpt-4')).toEqual({
        inputPer1k: 0.0015,
        outputPer1k: 0.002,
        provider: 'litellm',
        markup: 5,
      })
    })

    it('returns openrouter defaults for openrouter/ prefix', async () => {
      vi.mocked(getModel).mockResolvedValue(null)
      expect(await getModelPricing('openrouter/gpt-4')).toEqual({
        inputPer1k: 0.0015,
        outputPer1k: 0.002,
        provider: 'openrouter',
        markup: 5,
      })
    })

    it('returns together defaults for together/ prefix', async () => {
      vi.mocked(getModel).mockResolvedValue(null)
      expect(await getModelPricing('together/llama')).toEqual({
        inputPer1k: 0.001,
        outputPer1k: 0.002,
        provider: 'together',
        markup: 5,
      })
    })

    it('returns deepinfra defaults for deepinfra/ prefix', async () => {
      vi.mocked(getModel).mockResolvedValue(null)
      expect(await getModelPricing('deepinfra/llama')).toEqual({
        inputPer1k: 0.001,
        outputPer1k: 0.002,
        provider: 'deepinfra',
        markup: 5,
      })
    })

    it('returns venice default with 150% markup for unknown model without prefix', async () => {
      vi.mocked(getModel).mockResolvedValue(null)
      expect(await getModelPricing('completely-unknown-model')).toEqual({
        inputPer1k: 0.001,
        outputPer1k: 0.002,
        provider: 'venice',
        markup: 150,
      })
    })
  })

  describe('estimateCost', () => {
    it('calculates correct cost with markup for known model', async () => {
      vi.mocked(getModel).mockResolvedValue({
        id: 'deepseek-v3',
        inputPricePer1M: 0.50,
        outputPricePer1M: 1.50,
        markupPercent: 10,
        primaryProvider: 'venice',
      } as any)

      const cost = await estimateCost('deepseek-v3', 10000, 5000)
      expect(cost).toBe('2')
    })

    it('applies discount correctly', async () => {
      vi.mocked(getModel).mockResolvedValue({
        id: 'deepseek-v3',
        inputPricePer1M: 0.50,
        outputPricePer1M: 1.50,
        markupPercent: 10,
        primaryProvider: 'venice',
      } as any)

      const cost = await estimateCost('deepseek-v3', 10000, 5000, 50)
      expect(cost).toBe('1')
    })

    it('returns minimum 1 cent', async () => {
      vi.mocked(getModel).mockResolvedValue({
        id: 'deepseek-v3',
        inputPricePer1M: 0.50,
        outputPricePer1M: 1.50,
        markupPercent: 10,
        primaryProvider: 'venice',
      } as any)

      const cost = await estimateCost('deepseek-v3', 1, 1)
      expect(cost).toBe('1')
    })

    it('uses default discount of 0 when not provided', async () => {
      vi.mocked(getModel).mockResolvedValue({
        id: 'deepseek-v3',
        inputPricePer1M: 0.50,
        outputPricePer1M: 1.50,
        markupPercent: 10,
        primaryProvider: 'venice',
      } as any)

      expect(await estimateCost('deepseek-v3', 10000, 5000)).toBe(
        await estimateCost('deepseek-v3', 10000, 5000, 0)
      )
    })
  })

  describe('calculateActualCost', () => {
    it('delegates to models.calculateCost for known model', async () => {
      vi.mocked(getModel).mockResolvedValue({ id: 'deepseek-v3' } as any)
      vi.mocked(calculateCost).mockResolvedValue({
        costCents: '1',
        markupCents: '1',
        totalCents: '2',
      })

      const result = await calculateActualCost('deepseek-v3', 100, 50)
      expect(calculateCost).toHaveBeenCalledWith('deepseek-v3', 100, 50, 0)
      expect(result).toEqual({ costCents: '1', markupCents: '1', totalCents: '2' })
    })

    it('passes discount to models.calculateCost', async () => {
      vi.mocked(getModel).mockResolvedValue({ id: 'deepseek-v3' } as any)
      vi.mocked(calculateCost).mockResolvedValue({
        costCents: '1',
        markupCents: '0',
        totalCents: '1',
      })

      await calculateActualCost('deepseek-v3', 100, 50, 25)
      expect(calculateCost).toHaveBeenCalledWith('deepseek-v3', 100, 50, 25)
    })

    it('computes cost with markup breakdown for unknown model', async () => {
      vi.mocked(getModel).mockResolvedValue(null)

      const result = await calculateActualCost('unknown-model', 10000, 5000)
      expect(result).toEqual({ costCents: '2', markupCents: '4', totalCents: '5' })
    })

    it('applies discount correctly for unknown model', async () => {
      vi.mocked(getModel).mockResolvedValue(null)

      const result = await calculateActualCost('unknown-model', 10000, 5000, 50)
      expect(result).toEqual({ costCents: '2', markupCents: '1', totalCents: '3' })
    })

    it('returns minimum 1 cent for costCents and totalCents', async () => {
      vi.mocked(getModel).mockResolvedValue(null)

      const result = await calculateActualCost('unknown-model', 1, 1)
      expect(result.costCents).toBe('1')
      expect(result.totalCents).toBe('1')
    })
  })

  describe('calculateStreamingCost', () => {
    it('returns same result as calculateActualCost', async () => {
      vi.mocked(getModel).mockResolvedValue({ id: 'deepseek-v3' } as any)
      vi.mocked(calculateCost).mockResolvedValue({
        costCents: '2',
        markupCents: '3',
        totalCents: '5',
      })

      expect(await calculateStreamingCost('deepseek-v3', 100, 50)).toEqual(
        await calculateActualCost('deepseek-v3', 100, 50)
      )
    })
  })

  describe('getEstimatedOutputTokens', () => {
    it('returns Math.floor(maxTokens/4) for known model', async () => {
      vi.mocked(getModel).mockResolvedValue({ maxTokens: 65536 } as any)

      expect(await getEstimatedOutputTokens('deepseek-v3')).toBe(16384)
    })

    it('returns 1024 for unknown model', async () => {
      vi.mocked(getModel).mockResolvedValue(null)

      expect(await getEstimatedOutputTokens('unknown-model')).toBe(1024)
    })
  })
})