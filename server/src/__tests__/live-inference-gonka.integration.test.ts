/**
 * Live-inference integration tests for the Gonka/OpenBroker path
 * (gated on OMA_RUN_LIVE=1 + OMA_LIVE_PROVIDER=gonka)
 *
 * Hits the real openbroker api.openbroker.gonka.gg with a minimal request,
 * asserts the response shape, and (when run against the local OMA server)
 * verifies the routing chain end-to-end:
 *   OMA /v1/chat/completions → bearerAuth → gonka provider
 *   → openbroker api.openbroker.gonka.gg/v1/chat/completions → M2.7
 *
 * Skipped by default so CI runs don't hit paid APIs (or in this case the
 * devshard-backed broker that charges GNK per token).
 *
 * Run:    OMA_RUN_LIVE=1 OMA_LIVE_PROVIDER=gonka npm test src/__tests__/live-inference-gonka.integration.test.ts
 * Skip:    (default — OMA_RUN_LIVE is unset)
 *
 * Required env when enabled:
 *   OMA_RUN_LIVE=1
 *   OMA_LIVE_PROVIDER=gonka
 *   OMA_LIVE_API_KEY=<openbroker obk-* API key>
 *   OMA_ADMIN_DEBUG_KEY=<existing API key for the seed account>
 *
 * Critical URL conventions (would break tests if changed):
 *   - openbroker base URL: https://api.openbroker.gonka.gg/v1
 *   - OMA gonka config: GONKA_API_URL (no trailing /v1 — provider appends /v1/chat/completions)
 *   - Verified 2026-07-16: doubled /v1 returns 405 Method Not Allowed
 */

import { describe, it, expect } from 'vitest'

const ENABLED = process.env.OMA_RUN_LIVE === '1'
const provider = (process.env.OMA_LIVE_PROVIDER ?? '').toLowerCase()
const isGonka = ENABLED && provider === 'gonka'

describe.skipIf(!isGonka)('Live inference — Gonka/OpenBroker (gated)', () => {
  const apiKey = process.env.OMA_LIVE_API_KEY ?? ''
  const adminKey = process.env.OMA_ADMIN_DEBUG_KEY ?? ''
  const baseUrl = 'https://api.openbroker.gonka.gg/v1'

  // Minimal "OK" reply — M2.7 with thinking enabled responds in ~10-15s.
  const testRequest = {
    model: 'MiniMaxAI/MiniMax-M2.7',
    messages: [{ role: 'user' as const, content: 'Reply with single word: OK' }],
    stream: false,
  }

  it('openbroker: direct call returns OpenAI-shaped response (no /v1 doubling)', async () => {
    if (!apiKey) throw new Error('OMA_LIVE_API_KEY required when OMA_RUN_LIVE=1')

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The brokder requires the obk-* key as Bearer. gonka provider in OMA
        // sends this via Authorization: Bearer ${GONKA_API_KEY}.
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(testRequest),
    })

    expect(res.status, `expected 2xx, got ${res.status}`).toBeLessThan(300)
    const body = (await res.json()) as {
      id?: string
      object?: string
      model?: string
      choices?: Array<{ message?: { role?: string; content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }

    // OpenAI-compatible shape — verified against openbroker.gonka.gg 2026-07-16
    expect(body.object).toBe('chat.completion')
    expect(Array.isArray(body.choices)).toBe(true)
    expect(body.choices!.length).toBeGreaterThanOrEqual(1)
    expect(body.choices![0].message?.role).toBe('assistant')
    expect(typeof body.choices![0].message?.content).toBe('string')
    expect(body.usage?.total_tokens).toBeGreaterThan(0)
    // openbroker models return the gonka network model id (not the broker alias)
    expect(body.model).toBe('MiniMaxAI/MiniMax-M2.7')
  }, 30_000)

  it('openbroker rejects double /v1 path with 405 (regression for the doubled-URL bug)', async () => {
    if (!apiKey) throw new Error('OMA_LIVE_API_KEY required when OMA_RUN_LIVE=1')

    // OMA's gonka provider does baseUrl + '/v1/chat/completions'. If the
    // GONKA_API_URL default ends with '/v1', the final URL becomes /v1/v1/...
    // which openbroker rejects with 405. This regression test pins the
    // single-/v1 convention so the bug can't resurface silently.
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(testRequest),
    })

    expect(res.status, `expected 405 on doubled /v1 path, got ${res.status}`).toBe(405)
  }, 15_000)

  it('OMA /v1/chat/completions routes a real user request through openbroker → M2.7', async () => {
    if (!apiKey || !adminKey) {
      throw new Error('OMA_LIVE_API_KEY and OMA_ADMIN_DEBUG_KEY required when OMA_RUN_LIVE=1')
    }

    // The local OMA server must be running with GONKA_API_KEY set to apiKey in
    // its server/.env. The adminKey is an OMA API key (oma_sk_*) belonging to
    // the user that will be charged.
    const res = await fetch(`http://localhost:3001/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminKey}`,
      },
      body: JSON.stringify({
        model: 'minimax-m2.7', // OMA catalog id; maps to MiniMaxAI/MiniMax-M2.7 via gonka provider
        messages: [{ role: 'user', content: 'Reply with single word: OK' }],
        stream: false,
      }),
    })

    expect(res.status, `expected 2xx from OMA, got ${res.status}`).toBeLessThan(300)
    const body = (await res.json()) as {
      model?: string
      choices?: Array<{ message?: { content?: string } }>
    }

    // Server should have rewritten the OMA model id to the broker's id
    expect(body.model).toBe('MiniMaxAI/MiniMax-M2.7')
    expect(body.choices?.[0]?.message?.content).toBeTruthy()
  }, 60_000)
})
