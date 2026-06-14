import { describe, it, expect, vi } from 'vitest'

vi.mock('../models.js', () => ({
  estimateTokens: vi.fn((text: string) => {
    if (!text || text.length === 0) return 0
    return Math.ceil(text.length / 4)
  }),
}))

vi.mock('../../credits/index.js', () => ({
  refundCredits: vi.fn(),
}))

import { countMessageTokens, refundCreditsWithRetry } from '../credit-preflight.js'

describe('countMessageTokens', () => {
  it('counts tokens from string content messages', () => {
    const messages = [
      { role: 'user', content: 'hello world' },
      { role: 'assistant', content: 'hi there' },
    ]
    const result = countMessageTokens(messages)
    expect(result).toBeGreaterThan(0)
  })

  it('handles empty messages array', () => {
    expect(countMessageTokens([])).toBe(0)
  })

  it('handles messages with array content containing text parts', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'describe this image' },
        ],
      },
    ]
    const result = countMessageTokens(messages)
    expect(result).toBeGreaterThan(0)
  })

  it('skips non-text content parts', async () => {
    const { estimateTokens } = await import('../models.js')
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'hello' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } },
        ],
      },
    ]
    const result = countMessageTokens(messages)
    expect(result).toBeGreaterThan(0)
    expect(estimateTokens).toHaveBeenCalledWith('hello')
  })

  it('returns 0 for null content', () => {
    const messages = [{ role: 'user', content: null }]
    const result = countMessageTokens(messages as any)
    expect(result).toBe(0)
  })

  it('returns 0 for undefined content', () => {
    const messages = [{ role: 'user', content: undefined }]
    const result = countMessageTokens(messages as any)
    expect(result).toBe(0)
  })

  it('returns 0 for empty string content', () => {
    const messages = [{ role: 'user', content: '' }]
    const result = countMessageTokens(messages)
    expect(result).toBe(0)
  })
})

describe('refundCreditsWithRetry', () => {
  beforeEach(async () => {
    const { refundCredits } = await import('../../credits/index.js')
    vi.mocked(refundCredits).mockReset()
  })

  it('successfully refunds on first attempt', async () => {
    const { refundCredits } = await import('../../credits/index.js')
    vi.mocked(refundCredits).mockResolvedValue(undefined)

    await refundCreditsWithRetry('user-1', '100')
    expect(refundCredits).toHaveBeenCalledWith('user-1', '100', undefined)
    expect(refundCredits).toHaveBeenCalledTimes(1)
  })

  it('retries on failure and succeeds on retry', async () => {
    const { refundCredits } = await import('../../credits/index.js')
    vi.mocked(refundCredits)
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce(undefined)

    await refundCreditsWithRetry('user-1', '100', undefined, 3)
    expect(refundCredits).toHaveBeenCalledTimes(2)
  })

  it('gives up after max retries and logs error', async () => {
    const { refundCredits } = await import('../../credits/index.js')
    vi.mocked(refundCredits).mockRejectedValue(new Error('Persistent error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await refundCreditsWithRetry('user-1', '100', undefined, 2)

    expect(refundCredits).toHaveBeenCalledTimes(2)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Refund credits failed after 2 attempts'),
      expect.any(Error),
    )
    consoleSpy.mockRestore()
  })
})
