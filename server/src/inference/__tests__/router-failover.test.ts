import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../provider-health.js', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reportProviderResult: vi.fn(),
  stopBackgroundDbSync: vi.fn(),
  stopBackgroundProbing: vi.fn(),
  stopCacheCleanup: vi.fn(),
}))

// The polar-usage hook pulls in polar.ts → auth/middleware → siwe →
// config.ts. Mock the middleware chain so this test stays hermetic —
// we're testing router failover, not auth.
vi.mock('../../auth/middleware.js', () => ({
  sessionAuth: async (_c: any, next: () => void) => next(),
  bearerAuth: async (c: any, next: () => void) => {
    c.set('userId', 'user-1');
    c.set('apiKey', { id: 'key-1', keyHash: 'hash' });
    await next();
  },
  sessionOrBearerAuth: async (c: any, next: () => void) => {
    c.set('userId', 'user-1');
    c.set('apiKey', { id: 'key-1', keyHash: 'hash' });
    await next();
  },
  requireAdmin: async (_c: any, next: () => void) => next(),
  noAuthRetry: vi.fn(),
}))

vi.mock('../../credits/index.js', () => ({
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  preflightDeduction: vi.fn().mockResolvedValue(true),
  refundCredits: vi.fn(),
  refundCreditsWithRetry: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../models.js', () => ({
  getModel: vi.fn(),
  getModelCatalog: vi.fn(),
  resolveModelAlias: vi.fn((m: string) => Promise.resolve(m)),
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
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

vi.mock('../cross-provider-router.js', () => ({
  findProvidersForModel: vi.fn(),
  getCandidateProviders: vi.fn(),
  resolveModelAlias: vi.fn((m: string) => Promise.resolve(m)),
  recordFailover: vi.fn(),
  getRouterStats: vi.fn(() => ({ totalRequests: 0, failoverCount: 0, byProvider: {} })),
  __resetRouterStatsForTests: vi.fn(),
}))

vi.mock('../../config.js', () => ({
  config: {
    PROVIDER_WEIGHTS: undefined,
    RECEIPT_HMAC_SECRET: 'test-secret-at-least-32-chars!',
  },
}))

import * as router from '../router.js'
import { findProvidersForModel, getCandidateProviders } from '../cross-provider-router.js'

const mockBody = {
  model: 'llama-3.3-70b',
  messages: [{ role: 'user', content: 'hello' }],
  stream: false as const,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Router cross-provider failover', () => {
  it('tries the next provider when primary call fails', async () => {
    const { getModel } = await import('../models.js')
    const modelDef = {
      id: 'llama-3.3-70b',
      veniceId: 'llama-3.3-70b',
      surplusId: 'llama-3.3-70b-surplus',
      provider: 'both' as const,
      primaryProvider: 'venice' as const,
      inputPricePer1M: 0.35,
      outputPricePer1M: 0.90,
      markupPercent: 10,
      category: 'mid' as const,
      maxTokens: 8192,
      supportsStreaming: true,
      displayName: 'Llama 3.3 70B',
      capabilities: ['chat'],
      description: 'test',
      creditsPerMillionInput: 350,
      creditsPerMillionOutput: 900,
    }
    vi.mocked(getModel).mockResolvedValue(modelDef as any)
    vi.mocked(findProvidersForModel).mockResolvedValue(['venice', 'surplus'])
    vi.mocked(getCandidateProviders).mockResolvedValue({
      primary: 'venice',
      alternates: ['surplus'],
    })

    // venice fails with 502
    const { chatCompletion: veniceChat } = await import('../venice.js')
    vi.mocked(veniceChat).mockRejectedValue(
      Object.assign(new Error('upstream error'), { status: 502 })
    )

    // surplus succeeds
    const successResp = new Response(
      JSON.stringify({
        id: 'cmpl-1',
        model: 'llama-3.3-70b',
        choices: [{ message: { role: 'assistant', content: 'hi from surplus' } }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
    const { surplusChatCompletion: surplusChat } = await import('../surplus.js')
    vi.mocked(surplusChat).mockResolvedValue(successResp)

    const result = await router.handleChatCompletion('user-1', 'key-1', mockBody)

    expect(result.response).toBeInstanceOf(Response)
    expect(result.provider).toBe('surplus')
    expect(result.response.status).toBe(200)
    expect(surplusChat).toHaveBeenCalledTimes(1)
  })

  it('succeeds on primary without trying alternates', async () => {
    const { getModel } = await import('../models.js')
    const modelDef = {
      id: 'llama-3.3-70b',
      veniceId: 'llama-3.3-70b',
      surplusId: 'llama-3.3-70b-surplus',
      provider: 'both' as const,
      primaryProvider: 'venice' as const,
      inputPricePer1M: 0.35,
      outputPricePer1M: 0.90,
      markupPercent: 10,
      category: 'mid' as const,
      maxTokens: 8192,
      supportsStreaming: true,
      displayName: 'Llama 3.3 70B',
      capabilities: ['chat'],
      description: 'test',
      creditsPerMillionInput: 350,
      creditsPerMillionOutput: 900,
    }
    vi.mocked(getModel).mockResolvedValue(modelDef as any)
    vi.mocked(findProvidersForModel).mockResolvedValue(['venice', 'surplus'])
    vi.mocked(getCandidateProviders).mockResolvedValue({
      primary: 'venice',
      alternates: ['surplus'],
    })

    const successResp = new Response(
      JSON.stringify({
        id: 'cmpl-1',
        model: 'llama-3.3-70b',
        choices: [{ message: { role: 'assistant', content: 'hi from venice' } }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
    const { chatCompletion: veniceChat } = await import('../venice.js')
    vi.mocked(veniceChat).mockResolvedValue(successResp)

    const { surplusChatCompletion: surplusChat } = await import('../surplus.js')
    vi.mocked(surplusChat).mockResolvedValue(successResp)

    const result = await router.handleChatCompletion('user-1', 'key-1', mockBody)

    expect(result.provider).toBe('venice')
    expect(surplusChat).not.toHaveBeenCalled()
  })

  it('throws 502 when all providers fail', async () => {
    const { getModel } = await import('../models.js')
    const modelDef = {
      id: 'llama-3.3-70b',
      veniceId: 'llama-3.3-70b',
      surplusId: 'llama-3.3-70b-surplus',
      provider: 'both' as const,
      primaryProvider: 'venice' as const,
      inputPricePer1M: 0.35,
      outputPricePer1M: 0.90,
      markupPercent: 10,
      category: 'mid' as const,
      maxTokens: 8192,
      supportsStreaming: true,
      displayName: 'Llama 3.3 70B',
      capabilities: ['chat'],
      description: 'test',
      creditsPerMillionInput: 350,
      creditsPerMillionOutput: 900,
    }
    vi.mocked(getModel).mockResolvedValue(modelDef as any)
    vi.mocked(findProvidersForModel).mockResolvedValue(['venice', 'surplus'])
    vi.mocked(getCandidateProviders).mockResolvedValue({
      primary: 'venice',
      alternates: ['surplus'],
    })

    const { chatCompletion: veniceChat } = await import('../venice.js')
    vi.mocked(veniceChat).mockRejectedValue(
      Object.assign(new Error('venice down'), { status: 502 })
    )
    const { surplusChatCompletion: surplusChat } = await import('../surplus.js')
    vi.mocked(surplusChat).mockRejectedValue(
      Object.assign(new Error('surplus down'), { status: 502 })
    )

    await expect(router.handleChatCompletion('user-1', 'key-1', mockBody)).rejects.toMatchObject({
      status: 502,
    })
    expect(veniceChat).toHaveBeenCalledTimes(1)
    expect(surplusChat).toHaveBeenCalledTimes(1)
  })
})
