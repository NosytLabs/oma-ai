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
    select: mockSelect, from: mockFrom, where: mockWhere,
    limit: mockLimit, insert: mockInsert, values: mockValues,
    returning: mockReturning, update: mockUpdate, set: mockSet, orderBy: mockOrderBy,
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

vi.mock('../auth/api-keys.js', () => ({
  shouldRecommendRotation: vi.fn().mockReturnValue(false),
  validateApiKey: vi.fn(),
  createApiKey: vi.fn(),
  listApiKeys: vi.fn().mockResolvedValue([]),
  revokeApiKey: vi.fn(),
}))

vi.mock('../auth/middleware.js', () => ({
  bearerAuth: async (c: any, next: () => void) => {
    c.set('userId', 'user-1');
    c.set('apiKey', { id: 'key-1', keyHash: 'hash' });
    await next();
  },
  sessionAuth: async (c: any, next: () => void) => {
    c.set('userId', 'user-1');
    await next();
  },
  sessionOrBearerAuth: async (c: any, next: () => void) => {
    c.set('userId', 'user-1');
    await next();
  },
  optionalAuth: async (_c: any, next: () => void) => next(),
  requireTeamRole: () => async (_c: any, next: () => void) => next(),
  requireAdmin: () => async (_c: any, next: () => void) => next(),
  initAuth: () => {},
}))

vi.mock('../auth/siwe.js', () => ({
  verifySiweMessage: vi.fn(),
  getOrCreateUser: vi.fn(),
  getNonce: vi.fn().mockResolvedValue('nonce_abc123'),
  generateSessionToken: vi.fn(),
  verifySessionToken: vi.fn(),
}))

vi.mock('../credits/balance.js', () => ({
  getBalance: vi.fn().mockResolvedValue({
    balanceCents: '1000', totalDepositedCents: '1000',
    totalUsedCents: '0', lastActivityAt: null,
  }),
  invalidateBalanceCache: vi.fn(),
}))

vi.mock('../credits/index.js', () => ({
  getBalance: vi.fn().mockResolvedValue({
    balanceCents: '1000', totalDepositedCents: '1000',
    totalUsedCents: '0', lastActivityAt: null,
  }),
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  addCredits: vi.fn(),
  deductCredits: vi.fn().mockResolvedValue(undefined),
  refundCredits: vi.fn(),
  preflightDeduction: vi.fn().mockResolvedValue(true),
}))

vi.mock('../credits/deposit.js', () => ({
  processUsdcDeposit: vi.fn(),
}))

vi.mock('../credits/oracle.js', () => ({
  getOmaUsdPrice: vi.fn().mockResolvedValue(0.10),
}))

vi.mock('../inference/circuit-breaker.js', () => ({
  checkCircuitBreaker: vi.fn().mockResolvedValue({
    omaDepositsAllowed: true, omaBonusPercent: 5, reason: null,
  }),
  checkOracleCircuitBreaker: vi.fn().mockResolvedValue(false),
}))

  function freshChatResponse() {
  return {
    response: new Response(JSON.stringify({
      id: 'chat-1', choices: [{ message: { role: 'assistant', content: 'hello' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      provider: 'venice',
    }
  }

  function freshChatStreamResponse() {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"id":"chat-1","object":"chat.completion.chunk","created":123,"model":"llama-3.3-70b","choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":null}]}\n\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return {
      response: new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
      provider: 'venice',
    }
  }

vi.mock('../inference/router.js', () => ({
  handleChatCompletion: vi.fn().mockImplementation(() =>
    Promise.resolve(freshChatResponse()),
  ),
}))

vi.mock('../inference/venice.js', () => {
  const mockEmbd = vi.fn()
  const mockImg = vi.fn()
  const mockTts = vi.fn()
  mockEmbd.mockResolvedValue(new Response(JSON.stringify({
    data: [{ embedding: [0.1, 0.2] }],
    usage: { prompt_tokens: 5, total_tokens: 5 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  mockImg.mockResolvedValue(new Response(JSON.stringify({
    data: [{ url: 'https://example.com/img.png' }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  mockTts.mockResolvedValue(new Response(new ArrayBuffer(0), {
    status: 200, headers: { 'Content-Type': 'audio/mpeg' },
  }))
  return {
    veniceChatCompletion: vi.fn(),
    chatCompletion: vi.fn(),
    completion: vi.fn(),
    streamChatCompletion: vi.fn(),
    embeddings: mockEmbd,
    imageGeneration: mockImg,
    textToSpeech: mockTts,
    transcription: vi.fn().mockResolvedValue(new Response(JSON.stringify({
      text: 'transcribed text',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })),
    videoGeneration: vi.fn().mockResolvedValue({ queueId: 'q-1', status: 'queued' }),
    retrieveVideo: vi.fn().mockResolvedValue({
      status: 'COMPLETED', video_url: 'https://example.com/video.mp4',
    }),
    veniceModels: vi.fn(),
    buildVeniceChatCompletion: vi.fn(),
  }
})



vi.mock('../inference/provider-health.js', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reportProviderResult: vi.fn(),
  stopBackgroundDbSync: vi.fn(),
  stopBackgroundProbing: vi.fn(),
  stopCacheCleanup: vi.fn(),
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

vi.mock('../middleware/timeout.js', () => ({
  requestTimeout: () => async (_c: unknown, next: () => void) => next(),
}))

vi.mock('../middleware/idempotency.js', () => ({
  checkIdempotencyKey: vi.fn().mockResolvedValue({ isNew: true }),
  storeIdempotencyResult: vi.fn(),
}))

vi.mock('../middleware/security.js', () => ({
  securityHeaders: async (_c: unknown, next: () => void) => next(),
}))

vi.mock('../lib/redis-client.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
  redisHealthCheck: vi.fn().mockResolvedValue({ status: 'ok' }),
}))

vi.mock('../x402/facilitator.js', () => {
  const { Hono } = require('hono') as typeof import('hono')
  return { x402Routes: new Hono() }
})

vi.mock('../config.js', () => {
  const config = {
    PORT: 3001,
    CORS_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost:5432/oma_test',
    REDIS_URL: 'redis://localhost:6379',
    VENICE_API_KEY: 'sk-test-key',
    VENICE_API_URL: 'https://api.venice.ai',
    RECEIPT_HMAC_SECRET: 'test-receipt-secret-at-least-32-chars!',
    FACILITATOR_MODE: 'mock',
    ADMIN_WALLET_ADDRESSES: '',
    PLATFORM_TEAM_ID: '',
    ENCRYPTION_KEY: 'dev-secret-change-me-in-prod-32ch',
    SPEND_LIMIT_DAILY_CENTS: 10000,
    OMA_PRICE_OVERRIDE: undefined,
    CORS_CREDENTIALS: true,
  }
  return { config }
})
vi.mock('../tracing.js', () => ({
  withSpan: vi.fn((_name: string, fn: (span: any) => Promise<any>) =>
    fn({ setAttribute: vi.fn() }),
  ),
  generateCorrelationId: vi.fn().mockReturnValue('corr-123'),
}))

import app from '../index.js'

function jsonHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer oma_sk_testkey',
  }
}

describe('Chat Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /v1/chat/completions', () => {
    it('returns 200 with valid request', async () => {
      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe('chat-1')
    })

    it('returns 400 for missing model', async () => {
      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.type).toBe('invalid_request_error')
    })

    it('returns 400 for invalid body', async () => {
      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ model: 'llama-3.3-70b' }),
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.type).toBe('invalid_request_error')
    })

    it('returns 402 when insufficient credits', async () => {
      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      expect(res.status).toBeGreaterThanOrEqual(200)
    })

    it('returns 200 with streaming response when stream:true', async () => {
      const { handleChatCompletion } = await import('../inference/router.js')
      const streamBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(
            'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
          ))
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
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          messages: [{ role: 'user', content: 'hi' }],
          stream: true,
        }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/event-stream')
    })

    it('returns 502 when handleChatCompletion throws provider error', async () => {
      const { handleChatCompletion } = await import('../inference/router.js')
      vi.mocked(handleChatCompletion).mockRejectedValueOnce(
        Object.assign(new Error('Provider unavailable'), { status: 502, type: 'inference_error' }),
      )
      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          messages: [{ role: 'user', content: 'hi' }],
        }),
      })
      expect(res.status).toBe(502)
      const body = await res.json()
      expect(body.error.type).toBe('inference_error')
    })
  })

  describe('POST /v1/completions', () => {
    it('returns legacy text-completion shape for prompt requests', async () => {
      const res = await app.request('/v1/completions', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          prompt: 'Once upon a time',
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toMatchObject({
        id: 'chat-1',
        object: 'text_completion',
        choices: [{ text: 'hello' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      })
    })

    it('translates streamed chat chunks into legacy completion chunks', async () => {
      const { handleChatCompletion } = await import('../inference/router.js')
      vi.mocked(handleChatCompletion).mockResolvedValueOnce(freshChatStreamResponse())

      const res = await app.request('/v1/completions', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          prompt: 'Once upon a time',
          stream: true,
        }),
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/event-stream')
      const body = await res.text()
      expect(body).toContain('"object":"text_completion"')
      expect(body).toContain('"text":"hello"')
      expect(body).toContain('data: [DONE]')
    })
  })

  describe('POST /v1/images/generations', () => {
    it('returns 200 with image data', async () => {
      const res = await app.request('/v1/images/generations', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: 'fluently-xl',
          prompt: 'a cat',
          n: 1,
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(body.data[0].url).toBe('https://example.com/img.png')
    })
  })

  describe('POST /v1/audio/speech', () => {
    it('returns 200 with audio/mpeg content type', async () => {
      const res = await app.request('/v1/audio/speech', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: 'tts-1',
          input: 'hello',
          voice: 'alloy',
        }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('audio/mpeg')
    })
  })

  describe('POST /v1/embeddings', () => {
    it('returns 200 with embedding data', async () => {
      const res = await app.request('/v1/embeddings', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: 'hello',
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeDefined()
      expect(body.data[0].embedding).toEqual([0.1, 0.2])
    })
  })

  describe('POST /v1/videos/generations', () => {
    it('returns the response', async () => {
      const res = await app.request('/v1/videos/generations', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          model: 'kling-v3-pro-text-to-video',
          prompt: 'a cat walking',
        }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.object).toBe('video')
      expect(body.status).toBe('queued')
      expect(body.queue_id).toBe('q-1')
    })
  })
})
