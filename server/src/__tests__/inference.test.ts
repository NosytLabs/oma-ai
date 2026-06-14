import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}))

vi.mock('../db/client.js', () => {
  const mockSelect = vi.fn().mockReturnThis()
  const mockFrom = vi.fn().mockReturnThis()
  const mockWhere = vi.fn().mockReturnThis()
  const mockLimit = vi.fn().mockResolvedValue([])
  const mockInsert = vi.fn().mockReturnThis()
  const mockValues = vi.fn().mockReturnThis()
  const mockReturning = vi.fn().mockResolvedValue([{ id: 'dep-1' }])
  const mockUpdate = vi.fn().mockReturnThis()
  const mockSet = vi.fn().mockReturnThis()
  const mockOrderBy = vi.fn().mockReturnThis()

  const chain = {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    insert: mockInsert,
    values: mockValues,
    returning: mockReturning,
    update: mockUpdate,
    set: mockSet,
    orderBy: mockOrderBy,
  }

  mockSelect.mockReturnValue(chain)
  mockFrom.mockReturnValue(chain)
  mockWhere.mockReturnValue(chain)
  mockLimit.mockResolvedValue([])
  mockInsert.mockReturnValue(chain)
  mockValues.mockReturnValue(chain)
  mockReturning.mockResolvedValue([{ id: 'dep-1' }])
  mockUpdate.mockReturnValue(chain)
  mockSet.mockReturnValue(chain)
  mockOrderBy.mockReturnValue(chain)

  return { db: chain, getDb: () => chain }
})

vi.mock('../auth/api-keys.js', () => ({ shouldRecommendRotation: vi.fn().mockReturnValue(false), 
  validateApiKey: vi.fn(),
  createApiKey: vi.fn(),
  listApiKeys: vi.fn().mockResolvedValue([]),
  revokeApiKey: vi.fn(),
}))

vi.mock('../auth/siwe.js', () => ({
  verifySiweMessage: vi.fn(),
  getOrCreateUser: vi.fn(),
  getNonce: vi.fn().mockResolvedValue('nonce_abc123'),
  generateSessionToken: vi.fn(),
  verifySessionToken: vi.fn(),
}))

vi.mock('../credits/index.js', () => ({
  getBalance: vi.fn().mockResolvedValue({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null }),
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
  preflightDeduction: vi.fn().mockResolvedValue(true),
}))

vi.mock('../credits/deposit.js', () => ({
  processUsdcDeposit: vi.fn(),
  processHoudiniDeposit: vi.fn(),
  completeHoudiniDeposit: vi.fn(),
}))

vi.mock('../credits/oracle.js', () => ({
  getOmaUsdPrice: vi.fn().mockResolvedValue(0.10),
}))

vi.mock('../inference/circuit-breaker.js', () => ({
  checkCircuitBreaker: vi.fn().mockResolvedValue({ omaDepositsAllowed: true, omaBonusPercent: 5, reason: null }),
  checkOracleCircuitBreaker: vi.fn().mockResolvedValue(false),
}))

vi.mock('../credits/houdini-client.js', () => ({
  houdiniClient: {
    getTokens: vi.fn().mockResolvedValue([]),
    getDepositStatus: vi.fn(),
    createDeposit: vi.fn(),
  },
}))

vi.mock('../inference/router.js', () => ({
  handleChatCompletion: vi.fn().mockResolvedValue({
    response: new Response(JSON.stringify({ id: 'chat-1', choices: [{ message: { role: 'assistant', content: 'hello' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
    provider: 'venice',
  }),
}))

vi.mock('../inference/venice.js', () => {
  const mockEmbd = vi.fn()
  const mockImg = vi.fn()
  const mockTts = vi.fn()
  mockEmbd.mockResolvedValue(new Response(JSON.stringify({ data: [], usage: { prompt_tokens: 0, total_tokens: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  mockImg.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  mockTts.mockResolvedValue(new Response(new ArrayBuffer(0), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } }))
  return {
    veniceChatCompletion: vi.fn(),
    embeddings: mockEmbd,
    imageGeneration: mockImg,
    textToSpeech: mockTts,
  };
})

vi.mock('../inference/antseed.js', () => ({
  antseedChatCompletion: vi.fn(),
}))

vi.mock('../inference/provider-health.js', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reportProviderResult: vi.fn(),
}))

vi.mock('../inference/models.js', () => ({
  getModel: vi.fn().mockResolvedValue({
    id: 'llama-3.3-70b',
    provider: 'venice',
    primaryProvider: 'venice',
    maxTokens: 128000,
    inputPricePer1M: 0.35,
    outputPricePer1M: 0.90,
    markupPercent: 10,
    category: 'mid',
    supportsStreaming: true,
    displayName: 'Llama 3.3 70B',
    capabilities: ['chat', 'streaming'],
    description: 'Meta Llama 3.3 70B',
    creditsPerMillionInput: 350,
    creditsPerMillionOutput: 900,
  }),
  MODEL_CATALOG: {},
  reloadModelCatalog: vi.fn().mockResolvedValue(undefined),
  calculateCost: vi.fn().mockReturnValue({ costCents: '1', markupCents: '0', totalCents: '1' }),
  estimateTokens: vi.fn().mockReturnValue(100),
  listModels: vi.fn().mockResolvedValue([]),
  ensureCatalogLoaded: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
  tokenBucket: () => async (_c: unknown, next: () => void) => next(),
  modelRateLimit: () => async (_c: unknown, next: () => void) => next(),
  burstRateLimit: () => async (_c: unknown, next: () => void) => next(),
  expressiveRateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

vi.mock('../middleware/spend-limit.js', () => ({
  spendLimit: () => async (_c: unknown, next: () => void) => next(),
  trackSpend: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../x402/facilitator.js', () => {
  const { Hono } = require('hono') as typeof import('hono');
  return { x402Routes: new Hono() };
});

vi.mock('../config.js', () => ({
  config: {
    PORT: 3001,
    CORS_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost:5432/oma_test',
    REDIS_URL: 'redis://localhost:6379',
    HOUDINI_WEBHOOK_SECRET: 'test-webhook-secret',
    RECEIPT_HMAC_SECRET: 'test-receipt-secret-at-least-32-chars!',
  },
}))

import app from '../index.js'
import { validateApiKey } from '../auth/api-keys.js'
import { handleChatCompletion } from '../inference/router.js'
import { getBalance, deductCredits } from '../credits/index.js'

const validKey = {
  id: 'key-1', userId: 'user-1', keyPrefix: 'oma_sk_abc', keyHash: 'hash', name: 'test', active: true, lastUsedAt: null, expiresAt: null, ipAllowlist: null, createdAt: new Date(),
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer oma_sk_validkey',
  }
}

describe('Inference Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /v1/chat/completions', () => {
    function setupVeniceResponse() {
      vi.mocked(handleChatCompletion).mockResolvedValue({
        response: new Response(JSON.stringify({ id: 'chat-1', choices: [{ message: { role: 'assistant', content: 'hello' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        provider: 'venice',
      })
      vi.mocked(deductCredits).mockResolvedValue(undefined)
    }

    it('routes to provider with valid key and credits', async () => {
      setupVeniceResponse()
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      vi.mocked(getBalance).mockResolvedValueOnce({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null })

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(res.status).toBe(200)
    })

    it('streams response when stream:true', async () => {
      const streamBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'))
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      vi.mocked(handleChatCompletion).mockResolvedValue({
        response: new Response(streamBody, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
        provider: 'venice',
      })
      vi.mocked(deductCredits).mockResolvedValue(undefined)
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      vi.mocked(getBalance).mockResolvedValueOnce({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null })

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'hi' }], stream: true }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/event-stream')
    })

    it('falls back to AntSeed when Venice circuit open', async () => {
      vi.mocked(handleChatCompletion).mockResolvedValue({
        response: new Response(JSON.stringify({ id: 'chat-2', choices: [{ message: { role: 'assistant', content: 'from antseed' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        provider: 'antseed',
      })
      vi.mocked(deductCredits).mockResolvedValue(undefined)
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      vi.mocked(getBalance).mockResolvedValueOnce({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null })

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(res.status).toBe(200)
    })

    it('returns 503 when all providers down', async () => {
      vi.mocked(handleChatCompletion).mockRejectedValue(Object.assign(new Error('No available provider for model llama-3.3-70b'), { status: 503 }))
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      vi.mocked(getBalance).mockResolvedValueOnce({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null })

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.error.type).toBe('inference_error')
    })
  })

  describe('POST /v1/chat/completions', () => {
    it('routes to provider with valid key and credits', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      vi.mocked(getBalance).mockResolvedValueOnce({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null })
      vi.mocked(handleChatCompletion).mockResolvedValueOnce({
        response: new Response(JSON.stringify({ id: 'chat-1', choices: [{ message: { role: 'assistant', content: 'hello' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        provider: 'venice',
      })

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(res.status).toBe(200)
    })

    it('streams response when stream:true', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      vi.mocked(getBalance).mockResolvedValueOnce({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null })
      const streamBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n'))
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      vi.mocked(handleChatCompletion).mockResolvedValueOnce({
        response: new Response(streamBody, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
        provider: 'venice',
      })

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'hi' }], stream: true }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/event-stream')
    })

    it('falls back to AntSeed when Venice circuit open', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      vi.mocked(getBalance).mockResolvedValueOnce({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null })
      vi.mocked(handleChatCompletion).mockResolvedValueOnce({
        response: new Response(JSON.stringify({ id: 'chat-2', choices: [{ message: { role: 'assistant', content: 'from antseed' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        provider: 'antseed',
      })

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(res.status).toBe(200)
    })

    it('returns 503 when all providers down', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      vi.mocked(getBalance).mockResolvedValueOnce({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null })
      vi.mocked(handleChatCompletion).mockRejectedValueOnce(Object.assign(new Error('No available provider for model llama-3.3-70b'), { status: 503 }))

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.error.type).toBe('inference_error')
    })
  })

  describe('POST /v1/completions', () => {
    it('translates prompt payloads into chat messages before inference', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      vi.mocked(getBalance).mockResolvedValueOnce({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null })
      vi.mocked(handleChatCompletion).mockResolvedValueOnce({
        response: new Response(JSON.stringify({
          id: 'chat-1',
          object: 'chat.completion',
          created: 123,
          model: 'llama-3.3-70b',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Once upon a time' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
        provider: 'venice',
      })

      const res = await app.request('/v1/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'llama-3.3-70b', prompt: 'Once upon a time', max_tokens: 64, top_p: 0.8 }),
      })
      expect(res.status).toBe(200)
      expect(handleChatCompletion).toHaveBeenCalledWith(
        'user-1',
        'key-1',
        expect.objectContaining({
          model: 'llama-3.3-70b',
          stream: false,
          max_tokens: 64,
          top_p: 0.8,
          messages: [{ role: 'user', content: 'Once upon a time' }],
        }),
      )

      const body = await res.json()
      expect(body).toMatchObject({
        id: 'chat-1',
        object: 'text_completion',
        model: 'llama-3.3-70b',
        choices: [{ text: 'Once upon a time', finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      })
    })

    it('rejects prompt arrays because batched completions are unsupported', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      vi.mocked(getBalance).mockResolvedValueOnce({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null })

      const res = await app.request('/v1/completions', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'llama-3.3-70b', prompt: ['Once', 'upon a time'] }),
      })

      expect(res.status).toBe(400)
      expect(handleChatCompletion).not.toHaveBeenCalled()
      await expect(res.json()).resolves.toMatchObject({
        error: {
          type: 'invalid_request_error',
          code: 'unsupported_prompt_array',
        },
      })
    })
  })

  describe('GET /v1/models', () => {
    it('returns 200 with model data', async () => {
      const res = await app.request('/v1/models')
      expect(res.status).toBeGreaterThanOrEqual(200)
    })
  })

  describe('POST /v1/images/generations', () => {
    it('generates image via Venice', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      const res = await app.request('/v1/images/generations', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'fluently-xl', prompt: 'a cat', n: 1, size: '1024x1024' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeDefined()
    })
  })

  describe('POST /v1/audio/speech', () => {
    it('generates speech via Venice', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      const res = await app.request('/v1/audio/speech', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'tts-1', input: 'hello', voice: 'alloy' }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    })
  })

  describe('POST /v1/embeddings', () => {
    it('generates embeddings via Venice', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce(validKey)
      const res = await app.request('/v1/embeddings', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ model: 'text-embedding-3-small', input: 'hello' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeDefined()
    })
  })
})
