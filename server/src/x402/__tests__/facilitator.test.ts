// @ts-nocheck — test file with complex mock typing
/**
 * ISOLATED Unit Test for x402 BUG-1 payee-bypass fix
 * Target: server/src/x402/facilitator.ts
 *   - payeeAddress source: line 781-790
 *   - pre-verify payee pin: line 875-922 (BUG-1 fix)
 *   - route handler: /v1/x402/proxy/chat/completions (line 711)
 *
 * Exploit blocked: caller sends payload with `payee=ATTACKER`,
 * `payFrom=ATTACKER` for a USDC self-transfer. Previously the handler
 * only checked `decoded.recipient === payload.payee` (both
 * caller-controlled), so verification would pass and the request would
 * be forwarded to the inference router. Now: payee in payload MUST
 * match the server-pinned TREASURY_BASE_ADDRESS; mismatches return 400
 * with error.type = "invalid_payee".
 *
 * Session: ses_x402_bug1_payee_bypass
 * Test file: server/src/x402/__tests__/facilitator.test.ts
 * After passing, this file is the test that was created; the
 * implementation fix lives in facilitator.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mock (chain pattern, same as sibling x402-facilitator.test.ts) ──
const { chain, resetChain } = vi.hoisted(() => {
  type MockChain = Record<string, ReturnType<typeof vi.fn>> & {
    then: (onfulfilled: (value: unknown[]) => unknown, onrejected?: (reason: unknown) => unknown) => Promise<unknown>
  }
  const ch: MockChain = {} as unknown as MockChain
  const METHODS = [
    'select', 'from', 'where', 'limit',
    'insert', 'values', 'returning', 'update', 'set',
    'onConflictDoUpdate',
  ]
  for (const m of METHODS) {
    ch[m] = vi.fn()
  }
  Object.defineProperty(ch, 'then', {
    value: function (onfulfilled: (value: unknown[]) => unknown, onrejected?: (reason: unknown) => unknown) {
      return Promise.resolve([]).then(onfulfilled, onrejected)
    },
    writable: true, configurable: true,
  })
  function reset() {
    for (const m of METHODS) ch[m].mockReturnValue(ch)
  }
  return { chain: ch, resetChain: reset }
})

vi.mock('../../db/client.js', () => ({ db: chain, getDb: () => chain }))

// ── Redis mock ───────────────────────────────────────────────
const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
}))
vi.mock('../../lib/redis-client.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue(mockRedis),
}))

// ── DLQ mock ─────────────────────────────────────────────────
vi.mock('../../lib/dlq.js', () => ({
  addSettlementToDlq: vi.fn().mockResolvedValue(undefined),
}))

// ── Logger mock ──────────────────────────────────────────────
vi.mock('../../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(),
  },
}))

// ── Rate-limit mock (passthrough) ────────────────────────────
vi.mock('../../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

// ── Config mock (TREASURY pinned to a real-looking address) ──
// vi.hoisted factories run BEFORE module imports, so all constants
// used inside them must be defined inside the factory itself.
const TREASURY = '0x8581784D3E598cCa3482375CFF2409Ac9DD8c402'  // canonical server-pinned treasury (matches server/.env TREASURY_BASE_ADDRESS)
const ATTACKER = '0xAtT4ckeR0000000000000000000000000000000'
const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    TREASURY_BASE_ADDRESS: '0x8581784D3E598cCa3482375CFF2409Ac9DD8c402',
    HOUDINI_ADDRESS_TO: '0x8581784D3E598cCa3482375CFF2409Ac9DD8c402',
    X402_VERSION: 'v2',
    FACILITATOR_MODE: 'mock',
  },
}))
vi.mock('../../config.js', () => ({ config: mockConfig }))

// ── Auth middleware mock (no-op) ─────────────────────────────
vi.mock('../../auth/middleware.js', () => ({
  sessionAuth: async (_c: unknown, next: () => void) => next(),
}))

// ── Inference mocks (so the request gets past model + version checks) ──
vi.mock('../../inference/models.js', () => ({
  getModel: vi.fn().mockResolvedValue({ id: 'mock-model', name: 'mock' }),
}))
vi.mock('../../inference/provider-selector.js', () => ({
  selectProvider: vi.fn().mockResolvedValue({ provider: 'venice', providerModelId: 'mock' }),
}))
vi.mock('../../inference/call-provider.js', () => ({
  callProvider: vi.fn().mockResolvedValue({ content: 'mock-response' }),
}))

// ── USDC base constant (mirror real) ─────────────────────────
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

// ── Import AFTER all mocks (vi.mock is hoisted but module resolution needs the mocks) ──
import { x402Routes } from '../facilitator.js'
import { Hono } from 'hono'

// Mount x402Routes on a Hono app (same way server/src/index.ts does at L140)
const app = new Hono()
app.route('/', x402Routes)

function makeV1PaymentSig(payee: string): unknown {
  const now = Math.floor(Date.now() / 1000)
  return {
    x402Version: '1',
    signature: '0x' + 'ab'.repeat(65),  // 65-byte EIP-191 sig stand-in
    authorization: 'test-auth',
    payload: {
      x402Version: '1',
      scheme: 'evm',
      networkId: 'base',
      asset: USDC_BASE,
      amount: '1.00',
      payee,
      payFrom: payee,  // self-transfer to bypass — the original BUG-1 exploit
      maxAmountRequired: '1.00',
      validBefore: now + 3600,
      validAfter: now - 60,
    },
  }
}

function makeV2PaymentSig(payTo: string): unknown {
  const now = Math.floor(Date.now() / 1000)
  return {
    x402Version: 2,
    signature: '0x' + 'cd'.repeat(65),
    authorization: {
      from: payTo,  // self-transfer exploit
      to: payTo,
      value: '1000000',  // 1 USDC atomic
      validAfter: String(now - 60),
      validBefore: String(now + 3600),
      nonce: '0x' + 'ee'.repeat(32),
    },
    payload: {
      x402Version: 2,
      scheme: 'exact',
      network: 'eip155:8453',
      asset: USDC_BASE,
      amount: '1.00',
      payTo,  // v2 renamed from payee
      maxTimeoutSeconds: 60,
      validBefore: now + 3600,
      validAfter: now - 60,
      resource: '/v1/x402/proxy/chat/completions',
    },
  }
}

describe('x402 /v1/x402/proxy/chat/completions — BUG-1 payee-bypass fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  it('REJECTS v1 payload with payee=ATTACKER (BUG-1 exploit) → 400 invalid_payee', async () => {
    const res = await app.request('/v1/x402/proxy/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': JSON.stringify(makeV1PaymentSig(ATTACKER)),
      },
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as { error: { type: string; message: string } }
    expect(body.error.type).toBe('invalid_payee')
    expect(body.error.message).toMatch(/payee/i)
  })

  it('REJECTS v2 payload with payTo=ATTACKER (BUG-1 exploit) → 400 invalid_payee', async () => {
    const res = await app.request('/v1/x402/proxy/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': JSON.stringify(makeV2PaymentSig(ATTACKER)),
      },
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as { error: { type: string; message: string } }
    expect(body.error.type).toBe('invalid_payee')
  })

  it('ACCEPTS v1 payload with payee=TREASURY (passes payee pin, fails later at verification but NOT with 400)', async () => {
    const res = await app.request('/v1/x402/proxy/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': JSON.stringify(makeV1PaymentSig(TREASURY)),
      },
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      }),
    })

    // Payee pin passes → request flows to verifyPayment() which in mock mode
    // accepts the signature → settles → calls inference. The mocked
    // callProvider returns { content: 'mock-response' }, so we should see
    // either a 200 (success) or a downstream 500 (e.g. inference mock
    // returning wrong shape). Critically, NOT a 400 with invalid_payee.
    expect(res.status).not.toBe(400)
    if (res.status === 400) {
      const body = await res.json() as { error: { type: string } }
      expect(body.error.type).not.toBe('invalid_payee')
    }
  })

  it('ACCEPTS v2 payload with payTo=TREASURY (case-insensitive — Ethereum addresses are hex)', async () => {
    const lowerTreasury = TREASURY.toLowerCase()
    const res = await app.request('/v1/x402/proxy/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': JSON.stringify(makeV2PaymentSig(lowerTreasury)),
      },
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      }),
    })

    expect(res.status).not.toBe(400)
    if (res.status === 400) {
      const body = await res.json() as { error: { type: string } }
      expect(body.error.type).not.toBe('invalid_payee')
    }
  })
})

// ── Proxy implementation tests (TDD: write failing test, then implement) ──
import { callProvider as callProviderMock } from '../../inference/call-provider.js'

// ponytail: the proxy endpoint is intentionally 501 — the x402 direct proxy
// is not yet enabled (see facilitator.ts:809-819 and the `not_implemented` error
// message pointing users at /v1/chat/completions + API key, or /v1/x402/quote).
// The 4 tests below assert the 501 shape (status, error.type, no inference call).
// When someone implements the proxy for real (M-milestone: payment verify, HMAC
// receipt mint, model select, provider dispatch, stream pass-through), flip
// these back to the dispatch expectations. Don't sneak the implementation in
// as a "test fix" — the receipt header is signed money.
describe('x402 /v1/x402/proxy/chat/completions — proxy currently 501 not_implemented', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  it('REMAINS 501 for valid v1 payment (proxy not yet enabled, no inference dispatched)', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        id: 'chatcmpl-mock',
        choices: [{ message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop', index: 0 }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
    vi.mocked(callProviderMock).mockResolvedValueOnce(mockResponse)

    const res = await app.request('/v1/x402/proxy/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': JSON.stringify(makeV1PaymentSig(TREASURY)),
      },
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      }),
    })

    expect(res.status).toBe(501)
    const body = await res.json() as { error: { type: string; code: string } }
    expect(body.error.type).toBe('not_implemented')
    expect(body.error.code).toBe('x402_proxy_pending')
    // CRITICAL: the inference chain must NOT be invoked while the proxy is 501.
    // If this fails, someone wired dispatch but forgot to remove the 501.
    expect(vi.mocked(callProviderMock)).not.toHaveBeenCalled()
  })

  it('REMAINS 501 for stream=true (proxy not yet enabled, no SSE pass-through)', async () => {
    const streamBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'))
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    const mockStreamResponse = new Response(streamBody, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
    vi.mocked(callProviderMock).mockResolvedValueOnce(mockStreamResponse)

    const res = await app.request('/v1/x402/proxy/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': JSON.stringify(makeV1PaymentSig(TREASURY)),
      },
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'hi' }],
        stream: true,
      }),
    })

    expect(res.status).toBe(501)
    expect(vi.mocked(callProviderMock)).not.toHaveBeenCalled()
  })

  it('REMAINS 501 with no payment header (proxy not yet enabled)', async () => {
    const res = await app.request('/v1/x402/proxy/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })

    expect(res.status).toBe(501)
    const body = await res.json() as { error: { type: string } }
    expect(body.error.type).toBe('not_implemented')
  })

  it('returns 400 with malformed JSON header (V6 #11 fix)', async () => {
    // ponytail: was 501 ("feature not implemented"), now 400 ("client error").
    // Malformed X-PAYMENT is a malformed request, not a proxy-pending condition.
    const res = await app.request('/v1/x402/proxy/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': '{not-valid-json',
      },
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'hi' }],
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json() as { error: { type: string } }
    expect(body.error.type).toBe('invalid_payment')
  })
})
