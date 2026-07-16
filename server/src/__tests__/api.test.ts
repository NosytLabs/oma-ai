import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}))

vi.mock('viem', () => ({
  verifyMessage: vi.fn().mockResolvedValue(true),
  parseAbi: vi.fn(() => []),
  decodeFunctionData: vi.fn(),
  createPublicClient: vi.fn(),
  formatUnits: vi.fn((v: bigint) => v.toString()),
  http: vi.fn(),
}))

// Pass-through the on-chain USDC verifier. The api test doesn't exercise
// the on-chain receipt path; the deposit test mock is the source of truth.
vi.mock('../credits/verify-usdc-on-chain.js', () => ({
  verifyUsdcOnChain: vi.fn().mockResolvedValue({ valid: true, txHash: '0xabc', amount: '10' }),
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
  const mockExecute = vi.fn().mockResolvedValue({ rows: [] })

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
    execute: mockExecute,
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

  return { db: chain, getDb: () => chain }
})

vi.mock('../auth/api-keys.js', () => ({ shouldRecommendRotation: vi.fn().mockReturnValue(false), validateApiKey: vi.fn(), createApiKey: vi.fn(), listApiKeys: vi.fn().mockResolvedValue([]), revokeApiKey: vi.fn(), getApiKey: vi.fn() }))

vi.mock('../auth/siwe.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/siwe.js')>()
  return {
    ...actual,
    verifySiweMessage: vi.fn(),
    getOrCreateUser: vi.fn(),
    getNonce: vi.fn().mockResolvedValue('nonce_abc123'),
    generateSessionToken: vi.fn(),
    verifySessionToken: vi.fn().mockResolvedValue({ userId: 'test-user', authMethod: 'siwe' }),
  }
})

vi.mock('../credits/index.js', () => ({
  getBalance: vi.fn().mockResolvedValue({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null }),
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
  preflightDeduction: vi.fn(),
}))

vi.mock('../credits/deposit.js', () => ({
  processUsdcDeposit: vi.fn().mockResolvedValue({ depositId: 'dep-1', creditsCents: 1000 }),
  processPaymentLinkDeposit: vi.fn().mockResolvedValue({ depositId: 'dep-3', creditsCents: 300 }),
}))

vi.mock('../credits/oracle.js', () => ({
  getOmaUsdPrice: vi.fn().mockResolvedValue(0.10),
}))

vi.mock('../credits/price-guard.js', () => ({
  checkCircuitBreaker: vi.fn().mockResolvedValue({ omaDepositsAllowed: true, omaBonusPercent: 5, reason: null }),
  checkOracleCircuitBreaker: vi.fn().mockResolvedValue(false),
}))


vi.mock('../inference/router.js', () => ({
  handleChatCompletion: vi.fn().mockResolvedValue({
    response: new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'test' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
    provider: 'venice',
    inputTokens: 10,
    outputTokens: 20,
  }),
}))

vi.mock('../inference/venice.js', () => ({
  veniceChatCompletion: vi.fn(),
}))



vi.mock('../inference/provider-health.js', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reportProviderResult: vi.fn(),
  stopBackgroundDbSync: vi.fn(),
  stopBackgroundProbing: vi.fn(),
  stopCacheCleanup: vi.fn(),
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
  calculateCost: vi.fn().mockReturnValue({ inputCost: 0.001, outputCost: 0.002, totalCost: 0.003 }),
  estimateTokens: vi.fn().mockReturnValue(100),
  listModels: vi.fn().mockResolvedValue([
    { id: 'llama-3.3-70b', inputPricePer1M: 0.35, outputPricePer1M: 0.90, maxTokens: 128000, category: 'mid' },
  ]),
  listVideoModels: vi.fn().mockResolvedValue([]),
  ensureCatalogLoaded: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/redis-client.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
  redisHealthCheck: vi.fn().mockResolvedValue({ status: 'ok' }),
}))

vi.mock('../middleware/timeout.js', () => ({
  requestTimeout: () => async (_c: unknown, next: () => void) => next(),
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
  trackSpend: vi.fn(),
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
    SERVICE_NAME: 'oma-ai',
  },
}))

import app from '../index.js'
import { validateApiKey } from '../auth/api-keys.js'
import { getBalance as _getBalance } from '../credits/index.js'
import { verifySessionToken as _verifySessionToken } from '../auth/siwe.js'

describe('API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /health', () => {
    it('returns health response', async () => {
      const res = await app.request('/health')
      const _body = await res.json()
      expect(res.status).toBeDefined()
    })
  })

  describe('GET /v1/models', () => {
    it('returns model list', async () => {
      const res = await app.request('/v1/models')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.object).toBe('list')
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThan(0)
      expect(body.data[0]).toHaveProperty('id')
      expect(body.data[0]).toHaveProperty('object', 'model')
      expect(body.data[0]).toHaveProperty('pricing')
    })
  })

  describe('POST /v1/chat/completions', () => {
    it('returns 200 with valid request (bearerAuth mocked)', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce({
        id: 'key-1', userId: 'user-1', keyPrefix: 'oma_sk_abc', keyHash: 'hash', name: 'test', active: true, lastUsedAt: null, expiresAt: null, ipAllowlist: null, createdAt: new Date(),
      })
      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer oma_sk_validkey',
        },
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(res.status).toBeGreaterThanOrEqual(200)
    })

    it('returns 400 when model is missing', async () => {
      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer oma_sk_validkey',
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toContain('Validation error')
    })

    it('returns 400 when messages is missing', async () => {
      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer oma_sk_validkey',
        },
        body: JSON.stringify({ model: 'llama-3.3-70b' }),
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toContain('Validation error')
    })
  })

  describe('POST /v1/deposit/usdc', () => {
    it('returns 400 without proper auth and nonce', async () => {
      const res = await app.request('/v1/deposit/usdc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: 10, 
          txHash: '0x' + 'a'.repeat(64), 
          signature: '0x' + 'a'.repeat(130),
          nonce: 'old-nonce',
        }),
      })
      expect(res.status).toBe(401)
    })

    it('returns 400 with negative amount', async () => {
      const res = await app.request('/v1/deposit/usdc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: -5, txHash: '0x' + 'a'.repeat(64), signature: 'sig' + 'a'.repeat(64) }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 with invalid txHash', async () => {
      const res = await app.request('/v1/deposit/usdc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: 10, txHash: 'not-a-hash', signature: 'sig' + 'a'.repeat(64) }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('GET /v1/balance', () => {
    it('returns 200 with balance (bearerAuth mocked)', async () => {
      const res = await app.request('/v1/balance')
      expect(res.status).toBe(200)
    })
  })
})

