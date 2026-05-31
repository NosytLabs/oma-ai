import { describe, it, expect, vi } from 'vitest'
import * as router from '../inference/router.js'

vi.mock('../inference/provider-health.js', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reportProviderResult: vi.fn(),
}))

vi.mock('../credits/index.js', () => ({
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  preflightDeduction: vi.fn().mockResolvedValue(true),
  refundCredits: vi.fn(),
}))

vi.mock('../inference/models.js', () => ({
  getModel: vi.fn(),
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

vi.mock('../inference/antseed.js', () => ({
  chatCompletion: vi.fn(),
}))

vi.mock('../inference/openrouter.js', () => ({
  chatCompletion: vi.fn(),
}))

vi.mock('../inference/together.js', () => ({
  chatCompletion: vi.fn(),
}))

vi.mock('../inference/deepinfra.js', () => ({
  chatCompletion: vi.fn(),
}))

vi.mock('../inference/litellm.js', () => ({
  chatCompletion: vi.fn(),
}))

vi.mock('../inference/circuit-breaker.js', () => ({
  isCircuitOpen: vi.fn().mockResolvedValue(false),
  recordProviderSuccess: vi.fn(),
  recordProviderError: vi.fn(),
}))

vi.mock('../config.js', () => ({
  config: {
    PROVIDER_WEIGHTS: undefined,
    RECEIPT_HMAC_SECRET: 'test-secret-at-least-32-chars!',
  },
}))

describe('Router', () => {
  describe('selectProvider', () => {
    it('infers litellm provider for litellm/ prefix', async () => {
      const result = await router.selectProvider('litellm/anthropic/claude-3')
      expect(result.provider).toBe('litellm')
      expect(result.providerModelId).toBe('anthropic/claude-3')
    })

    it('infers openrouter for openrouter/ prefix', async () => {
      const result = await router.selectProvider('openrouter/anthropic/claude-3')
      expect(result.provider).toBe('openrouter')
    })

    it('throws 503 when all providers unavailable', async () => {
      const { isProviderAvailable } = await import('../inference/provider-health.js')
      vi.mocked(isProviderAvailable).mockResolvedValue(false)
      
      await expect(router.selectProvider('claude-3')).rejects.toMatchObject({
        message: expect.stringContaining('unavailable'),
        status: 503,
      })
    })
  })

  describe('handleChatCompletion', () => {
    const mockBody = {
      model: 'claude-3',
      messages: [{ role: 'user', content: 'hello' }],
      stream: false as const,
    }

it('does not refund credits when non-streaming call succeeds with error JSON', async () => {
      const { isProviderAvailable } = await import('../inference/provider-health.js')
      vi.mocked(isProviderAvailable).mockResolvedValue(true)

      const mockResp = new Response(JSON.stringify({ error: 'provider error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })

      const { chatCompletion } = await import('../inference/antseed.js')
      vi.mocked(chatCompletion).mockResolvedValue(mockResp)

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

      const { chatCompletion } = await import('../inference/antseed.js')
      vi.mocked(chatCompletion).mockResolvedValue(mockResp)

       const result = await router.handleChatCompletion('user-1', 'key-1', { ...mockBody, stream: true })

       expect(result.provider).toBe('antseed')
       expect(result.response).toBeInstanceOf(Response)
       expect(result.response.headers.get('Content-Type')).toContain('text/event-stream')
    })
  })
})