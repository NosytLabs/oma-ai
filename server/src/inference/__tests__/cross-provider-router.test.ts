import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../provider-health.js', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reportProviderResult: vi.fn(),
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
vi.mock('../antseed.js', () => ({ chatCompletion: vi.fn() }))
vi.mock('../openrouter.js', () => ({ chatCompletion: vi.fn() }))
vi.mock('../together.js', () => ({ chatCompletion: vi.fn() }))
vi.mock('../deepinfra.js', () => ({ chatCompletion: vi.fn() }))
vi.mock('../claude.js', () => ({ chatCompletion: vi.fn() }))
vi.mock('../gemini.js', () => ({ chatCompletion: vi.fn() }))

vi.mock('../circuit-breaker.js', () => ({
  isCircuitOpen: vi.fn().mockResolvedValue(false),
  recordProviderSuccess: vi.fn(),
  recordProviderError: vi.fn(),
}))

vi.mock('../provider-result.js', () => ({
  reportProviderResult: vi.fn(),
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
  it('returns ALL_PROVIDERS for a model that has slots for all providers', async () => {
    const modelDef = {
      id: 'llama-test',
      veniceId: 'llama-test',
      openrouterId: 'meta-llama/llama-test',
      togetherId: 'llama-test-together',
      deepinfraId: 'meta-llama/Llama-test',
      antseedId: 'llama-test',
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
    expect(providers.length).toBeGreaterThanOrEqual(4)
    expect(providers).toContain('venice')
    expect(providers).toContain('openrouter')
    expect(providers).toContain('together')
    expect(providers).toContain('deepinfra')
  })

  it('only returns providers with a non-null *Id field for the model', async () => {
    const modelDef = {
      id: 'claude-test',
      claudeId: 'claude-test',
      provider: 'claude' as const,
      primaryProvider: 'claude' as const,
      inputPricePer1M: 0,
      outputPricePer1M: 0,
      markupPercent: 0,
      category: 'frontier' as const,
      maxTokens: 200000,
      supportsStreaming: true,
      displayName: 'Claude Test',
      capabilities: [],
      description: 'claude only',
      creditsPerMillionInput: 0,
      creditsPerMillionOutput: 0,
    }
    const providers = await findProvidersForModel('claude-test', modelDef)
    expect(providers).toEqual(['claude'])
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
      openrouterId: 'meta-llama/llama-x',
      togetherId: 'llama-x-together',
      provider: 'both' as const,
      primaryProvider: 'openrouter' as const,
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
    expect(primary).toBe('openrouter')
    expect(alternates).toContain('venice')
    expect(alternates).toContain('together')
    expect(alternates[0]).not.toBe('openrouter')
  })
})

describe('resolveModelAlias', () => {
  it('resolves "llama" to a real llama model id from the catalog', async () => {
    const resolved = await resolveModelAlias('llama')
    expect(resolved).not.toBe('llama')
    expect(typeof resolved).toBe('string')
    expect(resolved.length).toBeGreaterThan(0)
    // Should not be the alias itself
    expect(resolved).not.toBe('llama')
  })

  it('resolves "auto" to a default model id', async () => {
    const resolved = await resolveModelAlias('auto')
    expect(resolved).not.toBe('auto')
    expect(typeof resolved).toBe('string')
  })

  it('passes through real model names unchanged', async () => {
    const resolved = await resolveModelAlias('gpt-4o-mini')
    expect(resolved).toBe('gpt-4o-mini')
  })

  it('passes through unknown names unchanged', async () => {
    const resolved = await resolveModelAlias('some-unknown-model-xyz')
    expect(resolved).toBe('some-unknown-model-xyz')
  })
})

describe('recordFailover / getRouterStats', () => {
  it('tracks a failover event', () => {
    recordFailover({ modelId: 'm1', fromProvider: 'venice', toProvider: 'openrouter', latencyMs: 1500 })
    const stats = getRouterStats()
    expect(stats.totalRequests).toBe(1)
    expect(stats.failoverCount).toBe(1)
    expect(stats.byProvider.venice.attempts).toBe(1)
    expect(stats.byProvider.openrouter.attempts).toBe(1)
    expect(stats.byProvider.venice.failovers).toBe(1)
  })

  it('aggregates multiple failovers', () => {
    recordFailover({ modelId: 'm1', fromProvider: 'venice', toProvider: 'openrouter', latencyMs: 100 })
    recordFailover({ modelId: 'm1', fromProvider: 'together', toProvider: 'deepinfra', latencyMs: 200 })
    recordFailover({ modelId: 'm2', fromProvider: 'venice', toProvider: 'antseed', latencyMs: 300 })
    const stats = getRouterStats()
    expect(stats.totalRequests).toBe(3)
    expect(stats.failoverCount).toBe(3)
    expect(stats.byProvider.venice.attempts).toBe(2)
    expect(stats.byProvider.venice.failovers).toBe(2)
    expect(stats.byProvider.openrouter.attempts).toBe(1)
    expect(stats.byProvider.together.attempts).toBe(1)
    expect(stats.byProvider.deepinfra.attempts).toBe(1)
    expect(stats.byProvider.antseed.attempts).toBe(1)
  })

  it('returns zero stats when nothing recorded', () => {
    const stats = getRouterStats()
    expect(stats.totalRequests).toBe(0)
    expect(stats.failoverCount).toBe(0)
  })
})
