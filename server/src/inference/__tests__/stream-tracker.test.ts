import { describe, it, expect, vi } from 'vitest'

vi.mock('../models.js', () => ({
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
}))

vi.mock('../billing-service.js', () => ({
  calculateActualCost: vi.fn().mockReturnValue({
    costCents: '3',
    markupCents: '1',
    totalCents: '4',
  }),
}))

vi.mock('../usage-service.js', () => ({
  recordUsage: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../credit-preflight.js', () => ({
  refundCreditsWithRetry: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../config.js', () => ({
  config: {
    DEBUG_STREAM: false,
  },
}))

import { createTrackingStream, getStreamMetrics } from '../stream-tracker.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function makeUpstream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

async function consumeStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const parts: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    parts.push(value)
  }
  return parts.map(c => decoder.decode(c)).join('')
}

const defaultParams = {
  model: null,
  modelId: 'deepseek-v3',
  inputTokens: 50,
  discountPercent: 0,
  userId: 'user-1',
  apiKeyId: 'key-1',
  provider: 'venice',
  estimatedTotalCents: '10',
  pricing: { inputPer1k: 0.1, outputPer1k: 0.3, provider: 'venice' as const, markup: 10 },
  requestId: 'req-1',
}

describe('createTrackingStream', () => {
  it('streams SSE data and returns transformed chunks', async () => {
    const upstream = makeUpstream([
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    const tracking = createTrackingStream(upstream, defaultParams.model, defaultParams.modelId, defaultParams.inputTokens, defaultParams.discountPercent, defaultParams.userId, defaultParams.apiKeyId, defaultParams.provider, defaultParams.estimatedTotalCents, defaultParams.pricing, defaultParams.requestId)
    const output = await consumeStream(tracking)
    expect(output).toContain('hello')
    expect(output).toContain('[DONE]')
  })

  it('tracks first token time correctly', async () => {
    const onStreamingMetrics = vi.fn().mockResolvedValue(undefined)
    const upstream = makeUpstream([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    const tracking = createTrackingStream(
      upstream, null, 'deepseek-v3', 50, 0, 'user-1', 'key-1',
      'venice', '10', defaultParams.pricing, 'req-1', onStreamingMetrics,
    )
    await consumeStream(tracking)
    expect(onStreamingMetrics).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('records usage and handles [DONE] signal', async () => {
    const upstream = makeUpstream([
      'data: {"choices":[{"delta":{"content":"hello"}}],"usage":{"completion_tokens":5}}\n\n',
      'data: [DONE]\n\n',
    ])
    const tracking = createTrackingStream(upstream, defaultParams.model, defaultParams.modelId, defaultParams.inputTokens, defaultParams.discountPercent, defaultParams.userId, defaultParams.apiKeyId, defaultParams.provider, defaultParams.estimatedTotalCents, defaultParams.pricing, defaultParams.requestId)
    await consumeStream(tracking)

    const { recordUsage } = await import('../usage-service.js')
    expect(recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-1',
        userId: 'user-1',
        modelId: 'deepseek-v3',
        provider: 'venice',
        outputTokens: 5,
      }),
    )
  })

  it('uses estimateTokens fallback when no usage data', async () => {
    const upstream = makeUpstream([
      'data: {"choices":[{"delta":{"content":"hello world"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    const tracking = createTrackingStream(upstream, defaultParams.model, defaultParams.modelId, defaultParams.inputTokens, defaultParams.discountPercent, defaultParams.userId, defaultParams.apiKeyId, defaultParams.provider, defaultParams.estimatedTotalCents, defaultParams.pricing, defaultParams.requestId)
    await consumeStream(tracking)

    const { recordUsage } = await import('../usage-service.js')
    expect(recordUsage).toHaveBeenCalled()
  })

  it('refunds on stream cancel', async () => {
    const upstream = makeUpstream(['data: {"choices":[{"delta":{"content":"test"}}]}\n\n'])
    const tracking = createTrackingStream(upstream, defaultParams.model, defaultParams.modelId, defaultParams.inputTokens, defaultParams.discountPercent, defaultParams.userId, defaultParams.apiKeyId, defaultParams.provider, defaultParams.estimatedTotalCents, defaultParams.pricing, defaultParams.requestId)
    const reader = tracking.getReader()
    await reader.read()
    await reader.cancel()

    const { refundCreditsWithRetry } = await import('../credit-preflight.js')
    expect(refundCreditsWithRetry).toHaveBeenCalledWith('user-1', '10')
  })

  it('handles parse errors gracefully', async () => {
    const before = getStreamMetrics().parseErrors
    const upstream = makeUpstream([
      'data: {invalid json}\n\n',
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      'data: [DONE]\n\n',
    ])
    const tracking = createTrackingStream(upstream, defaultParams.model, defaultParams.modelId, defaultParams.inputTokens, defaultParams.discountPercent, defaultParams.userId, defaultParams.apiKeyId, defaultParams.provider, defaultParams.estimatedTotalCents, defaultParams.pricing, defaultParams.requestId)
    await consumeStream(tracking)
    expect(getStreamMetrics().parseErrors).toBeGreaterThan(before)
  })
})
