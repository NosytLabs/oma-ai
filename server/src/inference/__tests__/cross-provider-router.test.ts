import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../provider-health.js', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reportProviderResult: vi.fn(),
  stopBackgroundDbSync: vi.fn(),
  stopBackgroundProbing: vi.fn(),
  stopCacheCleanup: vi.fn(),
  reportProviderResultSuccess: vi.fn(),
}))

vi.mock('../credits/index.js', () => ({
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  preflightDeduction: vi.fn().mockResolvedValue(true),
  refundCredits: vi.fn(),
  refundCreditsWithRetry: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../models.js', () => ({
  getModel: vi.fn(),
  getModelCatalog: vi.fn(),
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
  resolveModelAlias: vi.fn(),
}))

vi.mock('../billing-service.js', () => ({
  getModelPricing: vi.fn().mockReturnValue({
    inputPer1k: 0.1,
    outputPer1k: 0.3,
    markup: 10,
  }),
  calculateActualCost: vi.fn().mockReturnValue({
    costCents: '5',
    markupCents: '1',
    totalCents: '6',
  }),
  getEstimatedOutputTokens: vi.fn().mockReturnValue(100),
}))

vi.mock('../usage-service.js', () => ({
  recordUsage: vi.fn(),
}))

vi.mock('../venice.js', () => ({ chatCompletion: vi.fn() }))
vi.mock('../surplus.js', () => ({ surplusChatCompletion: vi.fn() }))

vi.mock('../circuit-breaker.js', () => ({
  isCircuitOpen: vi.fn().mockResolvedValue(false),
  recordProviderSuccess: vi.fn(),
  recordProviderError: vi.fn(),
}))

vi.mock('../provider-health.js', () => ({
  reportProviderResult: vi.fn(),
  stopBackgroundDbSync: vi.fn(),
  stopBackgroundProbing: vi.fn(),
  stopCacheCleanup: vi.fn(),
}))

vi.mock('../../config.js', () => ({
  config: {
    PROVIDER_WEIGHTS: undefined,
    RECEIPT_HMAC_SECRET: 'test-secret-at-least-32-chars!',
  },
}))

import {
  findProvidersForModel,
  getCandidateProviders,
  resolveModelAlias,
  recordFailover,
  getRouterStats,
  __resetRouterStatsForTests,
} from '../cross-provider-router.js'

beforeEach(() => {
  __resetRouterStatsForTests()
  vi.clearAllMocks()
})

describe('findProvidersForModel', () => {
  it('returns providers for a model that has slots for multiple providers', async () => {
    const modelDef = {
      id: 'llama-test',
      veniceId: 'llama-test',
      surplusId: 'llama-test-surplus',
      provider: 'both' as const,
      primaryProvider: 'venice' as const,
      inputPricePer1M: 0,
      outputPricePer1M: 0,
      markupPercent: 0,
      category: 'mid' as const,
      maxTokens: 8192,
      supportsStreaming: true,
      displayName: 'Test',
      capabilities: [],
      description: 'test',
      creditsPerMillionInput: 0,
      creditsPerMillionOutput: 0,
    }
    const providers = await findProvidersForModel('llama-test', modelDef)
    expect(providers.length).toBeGreaterThanOrEqual(2)
    expect(providers).toContain('venice')
    expect(providers).toContain('surplus')
  })

  it('only returns providers with a non-null *Id field for the model', async () => {
    const modelDef = {
      id: 'venice-only',
      veniceId: 'venice-only',
      provider: 'venice' as const,
      primaryProvider: 'venice' as const,
      inputPricePer1M: 0,
      outputPricePer1M: 0,
      markupPercent: 0,
      category: 'frontier' as const,
      maxTokens: 200000,
      supportsStreaming: true,
      displayName: 'Venice Only',
      capabilities: [],
      description: 'venice only',
      creditsPerMillionInput: 0,
      creditsPerMillionOutput: 0,
    }
    const providers = await findProvidersForModel('venice-only', modelDef)
    expect(providers).toEqual(['venice'])
  })

  it('returns empty array for null model def (model unknown to catalog)', async () => {
    const providers = await findProvidersForModel('unknown-model-xyz', null)
    expect(providers).toEqual([])
  })
})

describe('getCandidateProviders', () => {
  it('returns primary first, then alternates in stable order', async () => {
    const modelDef = {
      id: 'llama-x',
      veniceId: 'llama-x',
      surplusId: 'llama-x-surplus',
      provider: 'both' as const,
      primaryProvider: 'venice' as const,
      inputPricePer1M: 0,
      outputPricePer1M: 0,
      markupPercent: 0,
      category: 'mid' as const,
      maxTokens: 8192,
      supportsStreaming: true,
      displayName: 'X',
      capabilities: [],
      description: 'x',
      creditsPerMillionInput: 0,
      creditsPerMillionOutput: 0,
    }
    const { primary, alternates } = await getCandidateProviders('llama-x', modelDef)
    expect(primary).toBe('venice')
    expect(alternates).toContain('surplus')
    expect(alternates[0]).not.toBe('venice')
  })
})

describe('resolveModelAlias', () => {
  it('resolves "llama" to a real llama model id from the catalog', async () => {
    const resolved = await resolveModelAlias('llama')
    expect(resolved).not.toBe('llama')
    expect(typeof resolved).toBe('string')
    expect(resolved.length).toBeGreaterThan(0)
  })

  it('resolves "auto" to a default model id', async () => {
    const resolved = await resolveModelAlias('auto')
    expect(resolved).not.toBe('auto')
    expect(typeof resolved).toBe('string')
  })

  it('passes through real model names unchanged', async () => {
    const resolved = await resolveModelAlias('deepseek-v3.2')
    expect(resolved).toBe('deepseek-v3.2')
  })

  it('passes through unknown names unchanged', async () => {
    const resolved = await resolveModelAlias('some-unknown-model-xyz')
    expect(resolved).toBe('some-unknown-model-xyz')
  })
})

describe('recordFailover / getRouterStats', () => {
  it('tracks a failover event', () => {
    recordFailover({ modelId: 'm1', fromProvider: 'venice', toProvider: 'surplus', latencyMs: 1500 })
    const stats = getRouterStats()
    expect(stats.totalRequests).toBe(1)
    expect(stats.failoverCount).toBe(1)
    expect(stats.byProvider.venice.attempts).toBe(1)
    expect(stats.byProvider.surplus.attempts).toBe(1)
    expect(stats.byProvider.venice.failovers).toBe(1)
  })

  it('aggregates multiple failovers', () => {
    recordFailover({ modelId: 'm1', fromProvider: 'venice', toProvider: 'surplus', latencyMs: 100 })
    recordFailover({ modelId: 'm1', fromProvider: 'surplus', toProvider: 'venice', latencyMs: 200 })
    recordFailover({ modelId: 'm2', fromProvider: 'venice', toProvider: 'surplus', latencyMs: 300 })
    const stats = getRouterStats()
    expect(stats.totalRequests).toBe(3)
    expect(stats.failoverCount).toBe(3)
    expect(stats.byProvider.venice.attempts).toBe(3)
    expect(stats.byProvider.venice.failovers).toBe(2)
    expect(stats.byProvider.surplus.attempts).toBe(3)
    expect(stats.byProvider.surplus.failovers).toBe(1)
  })

  it('returns zero stats when nothing recorded', () => {
    const stats = getRouterStats()
    expect(stats.totalRequests).toBe(0)
    expect(stats.failoverCount).toBe(0)
  })
})
