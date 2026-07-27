import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getModelPricing,
  estimateCost,
  calculateActualCost,
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

    it('returns venice defaults for litellm/ prefix (no separate provider)', async () => {
      vi.mocked(getModel).mockResolvedValue(null)
      const pricing = await getModelPricing('litellm/gpt-4')
      expect(pricing.provider).toBe('venice')
      expect(pricing.inputPer1k).toBe(0.001)
      expect(pricing.outputPer1k).toBe(0.002)
    })

    it('returns venice defaults for openrouter/ prefix (no separate provider)', async () => {
      vi.mocked(getModel).mockResolvedValue(null)
      const pricing = await getModelPricing('openrouter/gpt-4')
      expect(pricing.provider).toBe('venice')
      expect(pricing.inputPer1k).toBe(0.001)
      expect(pricing.outputPer1k).toBe(0.002)
    })

    it('returns venice defaults for together/ prefix (no separate provider)', async () => {
      vi.mocked(getModel).mockResolvedValue(null)
      const pricing = await getModelPricing('together/llama')
      expect(pricing.provider).toBe('venice')
      expect(pricing.inputPer1k).toBe(0.001)
      expect(pricing.outputPer1k).toBe(0.002)
    })

    it('returns venice defaults for deepinfra/ prefix (no separate provider)', async () => {
      vi.mocked(getModel).mockResolvedValue(null)
      const pricing = await getModelPricing('deepinfra/llama')
      expect(pricing.provider).toBe('venice')
      expect(pricing.inputPer1k).toBe(0.001)
      expect(pricing.outputPer1k).toBe(0.002)
    })

    it('returns venice default with config markup for unknown model without prefix', async () => {
      vi.mocked(getModel).mockResolvedValue(null)
      const pricing = await getModelPricing('completely-unknown-model')
      expect(pricing).toEqual({
        inputPer1k: 0.001,
        outputPer1k: 0.002,
        provider: 'venice',
        markup: expect.any(Number),
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
      const cost = Number(result.costCents)
      const markup = Number(result.markupCents)
      const total = Number(result.totalCents)
      expect(cost).toBeGreaterThan(0)
      // totalCents ≈ costCents + markupCents (within 1 due to independent Math.ceil rounding)
      expect(Math.abs(total - (cost + markup))).toBeLessThanOrEqual(1)
    })

    it('applies discount correctly for unknown model', async () => {
      vi.mocked(getModel).mockResolvedValue(null)

      const withoutDiscount = await calculateActualCost('unknown-model', 10000, 5000)
      const withDiscount = await calculateActualCost('unknown-model', 10000, 5000, 50)
      // 50% discount must reduce total cost
      expect(Number(withDiscount.totalCents)).toBeLessThan(Number(withoutDiscount.totalCents))
      // Sub-cent precision: totalCents = (costCents + markupCents) × (1 − discount),
      // within a rounding step of 0.01¢.
      const gross = Number(withDiscount.costCents) + Number(withDiscount.markupCents)
      expect(Math.abs(Number(withDiscount.totalCents) - gross * 0.5)).toBeLessThanOrEqual(0.02)
    })

    it('bills tiny requests at sub-cent precision with a 0.01¢ floor', async () => {
      vi.mocked(getModel).mockResolvedValue(null)

      // 1+1 tokens ≈ $0.000003 — the old code ceiled this to a full cent
      // (~330× overcharge). Now it rounds to 0.01¢ ($0.0001) minimum.
      const result = await calculateActualCost('unknown-model', 1, 1)
      expect(result.costCents).toBe('0.00')
      expect(result.totalCents).toBe('0.01')
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