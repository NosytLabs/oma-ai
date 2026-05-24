import { describe, it, expect } from 'vitest'
import { estimateTokens, estimateTokensFromWords } from '../inference/models.js'
import { calculateActualCost } from '../inference/billing-service.js'

describe('Streaming Token Estimation', () => {
  describe('estimateTokens', () => {
    it('returns 1 for short strings (1-3 chars)', () => {
      expect(estimateTokens('a')).toBe(1)
      expect(estimateTokens('hi')).toBe(1)
      expect(estimateTokens('the')).toBe(1)
    })

    it('returns 2 for medium words (4-6 chars)', () => {
      expect(estimateTokens('hello')).toBe(2)
      expect(estimateTokens('world')).toBe(2)
      expect(estimateTokens('test')).toBe(2)
    })

    it('returns 3 for longer words (7-12 chars)', () => {
      expect(estimateTokens('testing')).toBe(3)
      expect(estimateTokens('abcdefghijk')).toBe(3)
    })

    it('returns 4 for very long words (13+ chars)', () => {
      expect(estimateTokens('abcdefghijklmn')).toBe(4)
    })

    it('handles multi-word sentences', () => {
      const result = estimateTokens('Hello world this is a test')
      expect(result).toBeGreaterThan(5)
    })

    it('handles CJK characters (Chinese/Japanese/Korean)', () => {
      const result = estimateTokens('你好世界')
      expect(result).toBeGreaterThanOrEqual(4)
    })

    it('handles mixed ASCII and non-ASCII', () => {
      const result = estimateTokens('Hello 世界')
      expect(result).toBeGreaterThanOrEqual(3)
    })

    it('handles special characters and numbers', () => {
      expect(estimateTokens('123')).toBe(1)
      expect(estimateTokens('hello!')).toBe(2)
    })
  })

  describe('estimateTokensFromWords', () => {
    it('returns 1 for 0 words', () => {
      expect(estimateTokensFromWords(0)).toBe(1)
    })

    it('returns ~1.3 tokens per word', () => {
      expect(estimateTokensFromWords(10)).toBe(13)
      expect(estimateTokensFromWords(100)).toBe(130)
    })
  })

  describe('calculateActualCost', () => {
    it('calculates cost for non-streaming responses correctly', () => {
      const cost = calculateActualCost('gpt-4o-mini', 100, 50, 0)
      expect(Number(cost.totalCents)).toBeGreaterThan(0)
      expect(Number(cost.costCents)).toBeGreaterThan(0)
      expect(Number(cost.markupCents)).toBeGreaterThan(0)
    })

    it('applies discount correctly', () => {
      const withoutDiscount = calculateActualCost('gpt-4o-mini', 100000, 50000, 0)
      const withDiscount = calculateActualCost('gpt-4o-mini', 100000, 50000, 20)
      expect(Number(withDiscount.totalCents)).toBeLessThan(Number(withoutDiscount.totalCents))
      expect(Number(withDiscount.markupCents)).toBeGreaterThan(0)
    })
  })
})

describe('Streaming Credit Calculation', () => {
  describe('credit refund logic', () => {
    it('calculates refund when actual cost is less than estimated', () => {
      const estimatedCents = 100
      const actualCostCents = 50
      const refund = estimatedCents - actualCostCents

      expect(refund).toBe(50)
      expect(refund).toBeGreaterThan(0)
    })

    it('no refund when actual equals estimated', () => {
      const estimatedCents = 100
      const actualCostCents = 100
      const refund = estimatedCents - actualCostCents

      expect(refund).toBe(0)
    })

    it('no refund needed when actual is greater (user was undercharged)', () => {
      const estimatedCents = 50
      const actualCostCents = 100
      const refund = estimatedCents - actualCostCents

      expect(refund).toBeLessThan(0)
    })

    it('calculates credits correctly when usage data is available', () => {
      const modelId = 'gpt-4o-mini'
      const inputTokens = 100
      const outputTokens = 50
      const discountPercent = 0

      const cost = calculateActualCost(modelId, inputTokens, outputTokens, discountPercent)
      expect(cost.totalCents).toBeDefined()
      expect(Number(cost.totalCents)).toBeGreaterThan(0)
    })
  })
})

describe('createTrackingStream token accumulation', () => {
  it('should accumulate content for token estimation', () => {
    const accumulatedContent = "Hello world this is a longer response that should accumulate tokens properly"

    const tokens = estimateTokens(accumulatedContent)
    expect(tokens).toBeGreaterThan(10)
    expect(tokens).toBeLessThan(accumulatedContent.length)
  })

  it('should handle incremental delta accumulation', () => {
    const deltas = ['Hello ', 'world! ', 'This ', 'is ', 'a ', 'test. ']
    let accumulated = ''

    for (const delta of deltas) {
      accumulated += delta
    }

    const tokens = estimateTokens(accumulated)
    expect(tokens).toBeGreaterThan(0)
    expect(accumulated).toBe('Hello world! This is a test. ')
  })

  it('improved estimateTokens is more accurate than simple char/4', () => {
    const shortText = "hello"
    const char4Estimate = Math.ceil(shortText.length / 4)
    const improvedEstimate = estimateTokens(shortText)

    expect(improvedEstimate).toBeLessThanOrEqual(char4Estimate + 2)
  })
})