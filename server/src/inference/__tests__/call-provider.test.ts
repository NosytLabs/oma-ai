import { describe, it, expect, vi } from 'vitest'

vi.mock('../venice.js', () => ({ chatCompletion: vi.fn() }))
vi.mock('../surplus.js', () => ({ surplusChatCompletion: vi.fn() }))
vi.mock('../provider-health.js', () => ({ reportProviderResult: vi.fn() }))
vi.mock('../circuit-breaker.js', () => ({
  isCircuitOpen: vi.fn().mockResolvedValue(false),
  recordProviderSuccess: vi.fn(),
  recordProviderError: vi.fn(),
}))

import { callProvider } from '../call-provider.js'

const mockBody = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hello' }],
  stream: false,
}

describe('callProvider', () => {
  it('successfully calls venice provider and returns response', async () => {
    const mockResp = new Response('ok', { status: 200 })
    const { chatCompletion } = await import('../venice.js')
    vi.mocked(chatCompletion).mockResolvedValue(mockResp)

    const result = await callProvider('venice', 'test-model', mockBody)

    expect(result).toBe(mockResp)
    expect(chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'test-model', messages: mockBody.messages })
    )
  })

  it('routes to surplus provider', async () => {
    const mockResp = new Response('ok', { status: 200 })
    const { surplusChatCompletion } = await import('../surplus.js')
    vi.mocked(surplusChatCompletion).mockResolvedValue(mockResp)

    const result = await callProvider('surplus', 'test-model', mockBody)
    expect(result).toBe(mockResp)
  })

  it('throws on unknown provider', async () => {
    const unknown = 'not-a-real-provider' as unknown as Parameters<typeof callProvider>[0]
    await expect(callProvider(unknown, 'test-model', mockBody)).rejects.toThrow(/Unknown inference provider/)
  })

  it('reports provider success on successful call', async () => {
    const mockResp = new Response('ok', { status: 200 })
    const { chatCompletion } = await import('../venice.js')
    vi.mocked(chatCompletion).mockResolvedValue(mockResp)

    await callProvider('venice', 'test-model', mockBody)

    const { reportProviderResult } = await import('../provider-health.js')
    expect(reportProviderResult).toHaveBeenCalledWith('venice', true, expect.any(Number))

    const { recordProviderSuccess } = await import('../circuit-breaker.js')
    expect(recordProviderSuccess).toHaveBeenCalledWith('venice', 'test-model')
  })

  it('reports provider error on failed call', async () => {
    const { chatCompletion } = await import('../venice.js')
    vi.mocked(chatCompletion).mockRejectedValue(new Error('Provider error'))

    await expect(callProvider('venice', 'test-model', mockBody)).rejects.toThrow('Provider error')

    const { reportProviderResult } = await import('../provider-health.js')
    expect(reportProviderResult).toHaveBeenCalledWith('venice', false, expect.any(Number))

    const { recordProviderError } = await import('../circuit-breaker.js')
    expect(recordProviderError).toHaveBeenCalledWith('venice', 'test-model')
  })

  it('throws error with original status when provider returns error', async () => {
    const { chatCompletion } = await import('../venice.js')
    const providerErr = Object.assign(new Error('Rate limited'), { status: 429 })
    vi.mocked(chatCompletion).mockRejectedValue(providerErr)

    await expect(callProvider('venice', 'test-model', mockBody)).rejects.toMatchObject({
      status: 429,
      message: 'Rate limited',
    })
  })

  it('throws 503 when circuit breaker is open', async () => {
    const { isCircuitOpen } = await import('../circuit-breaker.js')
    vi.mocked(isCircuitOpen).mockResolvedValue(true)

    await expect(callProvider('venice', 'test-model', mockBody)).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('Circuit breaker open'),
    })

    vi.mocked(isCircuitOpen).mockResolvedValue(false)
  })
})
