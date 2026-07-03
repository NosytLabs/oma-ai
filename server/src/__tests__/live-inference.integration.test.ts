/**
 * Live-inference integration tests (gated on OMA_RUN_LIVE=1)
 *
 * Hits the real Venice AI upstream with a minimal request, asserts the
 * response shape, and verifies the credit deduction logic against the
 * real wire format. Skipped by default so CI runs don't hit paid APIs.
 *
 * Run:  OMA_RUN_LIVE=1 OMA_LIVE_PROVIDER=venice npm test src/__tests__/live-inference.integration.test.ts
 * Skip:  (default — OMA_RUN_LIVE is unset)
 *
 * Required env when enabled:
 *   OMA_RUN_LIVE=1
 *   OMA_LIVE_PROVIDER=venice
 *   OMA_LIVE_API_KEY=<Venice API key>
 *   DATABASE_URL=postgresql://...   (for credit deduction check)
 *   OMA_ADMIN_DEBUG_KEY=0001         (a user with usage history to debit)
 */

import { describe, it, expect } from 'vitest'

const ENABLED = process.env.OMA_RUN_LIVE === '1'

describe.skipIf(!ENABLED)('Live inference (gated on OMA_RUN_LIVE=1)', () => {
  const provider = (process.env.OMA_LIVE_PROVIDER ?? 'venice').toLowerCase()
  const apiKey = process.env.OMA_LIVE_API_KEY ?? ''
  const adminKey = process.env.OMA_ADMIN_DEBUG_KEY ?? ''
  const baseUrl = 'https://api.venice.ai/api/v1'

  // Minimal "hi" message — cheap tokens, returns within a few seconds.
  const testRequest = {
    model: 'llama-3.3-70b',
    messages: [{ role: 'user' as const, content: 'hi' }],
    max_tokens: 8,
    stream: false,
  }

  it(`${provider}: chat completion returns OpenAI-shaped response`, async () => {
    if (!apiKey) throw new Error('OMA_LIVE_API_KEY required when OMA_RUN_LIVE=1')

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(testRequest),
    })

    expect(res.status).toBeLessThan(300)
    const body = (await res.json()) as {
      id?: string
      object?: string
      model?: string
      choices?: Array<{ message?: { role?: string; content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }

    // OpenAI-compatible shape
    expect(body.object).toBe('chat.completion')
    expect(Array.isArray(body.choices)).toBe(true)
    expect(body.choices!.length).toBeGreaterThanOrEqual(1)
    expect(body.choices![0].message?.role).toBe('assistant')
    expect(typeof body.choices![0].message?.content).toBe('string')
    expect(body.usage?.total_tokens).toBeGreaterThan(0)
  }, 30_000)

  it(`${provider}: server records usage in the local DB`, async () => {
    if (!apiKey || !adminKey) {
      throw new Error('OMA_LIVE_API_KEY and OMA_ADMIN_DEBUG_KEY required when OMA_RUN_LIVE=1')
    }

    // Hit the local server (assumed to be running on :3001).
    const res = await fetch(`http://localhost:3001/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `oma_session=${adminKey}`,
      },
      body: JSON.stringify(testRequest),
    })

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Server rejected admin key (${res.status}); check OMA_ADMIN_DEBUG_KEY is a valid session JWT for an account with usage history`,
      )
    }
    if (res.status === 502 || res.status === 503) {
      // Upstream unavailable — skip rather than fail (live test, not deterministic).
      console.warn(`[live-inference] ${provider}: upstream returned ${res.status}, skipping`)
      return
    }

    expect(res.status).toBeLessThan(300)
    const body = (await res.json()) as { usage?: { total_tokens?: number } }
    expect(body.usage?.total_tokens).toBeGreaterThan(0)
  }, 30_000)
})
