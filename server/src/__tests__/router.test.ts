import { describe, it, expect, vi } from 'vitest'
import * as router from '../inference/router.js'

vi.mock('../inference/provider-health.js', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reportProviderResult: vi.fn(),
  stopBackgroundDbSync: vi.fn(),
  stopBackgroundProbing: vi.fn(),
  stopCacheCleanup: vi.fn(),
}))

vi.mock('../credits/index.js', () => ({
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  preflightDeduction: vi.fn().mockResolvedValue(true),
  refundCredits: vi.fn(),
}))

vi.mock('../inference/models.js', () => ({
  getModel: vi.fn().mockResolvedValue({
    id: 'llama-3.3-70b',
    gonkaId: 'llama-3.3-70b',
    veniceId: 'llama-3.3-70b',
    providers: { gonka: 'llama-3.3-70b', venice: 'llama-3.3-70b' },
    contextWindow: 131072,
    maxOutputTokens: 4096,
    primaryProvider: 'gonka',
  }),
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
}))

vi.mock('../inference/billing-service.js', () => ({
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

vi.mock('../inference/usage-service.js', () => ({
  recordUsage: vi.fn(),
}))

vi.mock('../inference/venice.js', () => ({
  chatCompletion: vi.fn(),
}))

vi.mock('../inference/gonka.js', () => ({
  chatCompletion: vi.fn(),
}))

vi.mock('../inference/surplus.js', () => ({
  surplusChatCompletion: vi.fn(),
}))

vi.mock('../inference/circuit-breaker.js', () => ({
  isCircuitOpen: vi.fn().mockResolvedValue(false),
  recordProviderSuccess: vi.fn(),
  recordProviderError: vi.fn(),
}))

vi.mock('../inference/call-provider.js', () => ({
  callProvider: vi.fn(),
}))

vi.mock('../inference/cross-provider-router.js', () => ({
  getCandidateProviders: vi.fn().mockResolvedValue({
    primary: 'gonka',
    alternates: [],
  }),
  recordFailover: vi.fn(),
}))

vi.mock('../inference/credit-preflight.js', () => ({
  countMessageTokens: vi.fn().mockReturnValue(5),
  refundCreditsWithRetry: vi.fn(),
}))

vi.mock('../inference/stream-tracker.js', () => ({
  createTrackingStream: vi.fn((stream: ReadableStream) => stream),
}))

vi.mock('../config.js', () => ({
  config: {
    PROVIDER_WEIGHTS: undefined,
    RECEIPT_HMAC_SECRET: 'test-secret-at-least-32-chars!',
  },
}))

describe('Router', () => {
  describe('selectProvider', () => {
    it('selects gonka as default provider', async () => {
      const result = await router.selectProvider('llama-3.3-70b')
      expect(result.provider).toBe('gonka')
    })

    it('throws 503 when all providers unavailable', async () => {
      const { isProviderAvailable } = await import('../inference/provider-health.js')
      vi.mocked(isProviderAvailable).mockResolvedValue(false)

      await expect(router.selectProvider('llama-3.3-70b')).rejects.toMatchObject({
        message: expect.stringContaining('unavailable'),
        status: 503,
      })
    })
  })

  describe('handleChatCompletion', () => {
    const mockBody = {
      model: 'llama-3.3-70b',
      messages: [{ role: 'user', content: 'hello' }],
      stream: false as const,
    }

    it('does not refund credits when non-streaming call succeeds with error JSON', async () => {
      const { isProviderAvailable } = await import('../inference/provider-health.js')
      vi.mocked(isProviderAvailable).mockResolvedValue(true)

      const mockResp = new Response(JSON.stringify({ error: 'provider error' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })

      const { callProvider } = await import('../inference/call-provider.js')
      vi.mocked(callProvider).mockResolvedValue(mockResp)

      const { refundCredits } = await import('../credits/index.js')
      vi.mocked(refundCredits).mockResolvedValue(undefined)

      const result = await router.handleChatCompletion('user-1', 'key-1', mockBody)
      expect(result.response).toBeInstanceOf(Response)
      expect(refundCredits).not.toHaveBeenCalled()
    })

    it('handles streaming response correctly', async () => {
      const { isProviderAvailable } = await import('../inference/provider-health.js')
      vi.mocked(isProviderAvailable).mockResolvedValue(true)

      const streamBody = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hi"}}],"usage":{"completion_tokens":2}}\n\n'))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      const mockResp = new Response(streamBody, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })

      const { callProvider } = await import('../inference/call-provider.js')
      vi.mocked(callProvider).mockResolvedValue(mockResp)

      const result = await router.handleChatCompletion('user-1', 'key-1', { ...mockBody, stream: true })

      expect(result.provider).toBe('gonka')
      expect(result.response).toBeInstanceOf(Response)
      expect(result.response.headers.get('Content-Type')).toContain('text/event-stream')
    })
  })
})
