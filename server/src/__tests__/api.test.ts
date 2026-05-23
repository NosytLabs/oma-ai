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

vi.mock('../auth/api-keys.js', () => ({
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

vi.mock('../credits/balance.js', () => ({
  getBalance: vi.fn().mockResolvedValue({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null }),
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
  preflightDeduction: vi.fn(),
}))

vi.mock('../credits/deposit.js', () => ({
  processUsdcDeposit: vi.fn(),
  processHoudiniDeposit: vi.fn(),
  completeHoudiniDeposit: vi.fn(),
}))

vi.mock('../credits/oracle.js', () => ({
  getOmaUsdPrice: vi.fn().mockResolvedValue(0.10),
}))

vi.mock('../credits/price-guard.js', () => ({
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
  handleChatCompletion: vi.fn(),
}))

vi.mock('../inference/venice.js', () => ({
  veniceChatCompletion: vi.fn(),
}))

vi.mock('../inference/antseed.js', () => ({
  antseedChatCompletion: vi.fn(),
}))

vi.mock('../inference/provider-health.js', () => ({
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reportProviderResult: vi.fn(),
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
  },
}))

import app from '../index.js'
import { validateApiKey } from '../auth/api-keys.js'
import { getBalance } from '../credits/balance.js'
import { verifySessionToken } from '../auth/siwe.js'

describe('API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await app.request('/health')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('ok')
      expect(body.service).toBe('oma-ai')
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
    it('returns 401 without auth', async () => {
      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.type).toBe('authentication_error')
    })

    it('returns 401 with invalid API key', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce(null)
      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer oma_sk_invalidkey',
        },
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.message).toContain('Invalid API key')
    })

    it('returns 402 with valid key but no credits', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce({
        id: 'key-1', userId: 'user-1', keyPrefix: 'oma_sk_abc', keyHash: 'hash', name: 'test', active: true, lastUsedAt: null, createdAt: new Date(),
      })
      vi.mocked(getBalance).mockResolvedValueOnce({ balanceCents: '0', totalDepositedCents: '0', totalUsedCents: '0', lastActivityAt: null })

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer oma_sk_validkey',
        },
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'hi' }] }),
      })
      expect(res.status).toBe(402)
      const body = await res.json()
      expect(body.error.type).toBe('insufficient_quota')
    })

    it('returns 400 when model is missing', async () => {
      vi.mocked(validateApiKey).mockResolvedValueOnce({
        id: 'key-1', userId: 'user-1', keyPrefix: 'oma_sk_abc', keyHash: 'hash', name: 'test', active: true, lastUsedAt: null, createdAt: new Date(),
      })

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
      vi.mocked(validateApiKey).mockResolvedValueOnce({
        id: 'key-1', userId: 'user-1', keyPrefix: 'oma_sk_abc', keyHash: 'hash', name: 'test', active: true, lastUsedAt: null, createdAt: new Date(),
      })

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
    it('returns 401 without auth', async () => {
      const res = await app.request('/v1/deposit/usdc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 10, txHash: '0x' + 'a'.repeat(64) }),
      })
      expect(res.status).toBe(401)
    })

    it('returns 400 with negative amount', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      const res = await app.request('/v1/deposit/usdc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: -5, txHash: '0x' + 'a'.repeat(64) }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 with invalid txHash', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      const res = await app.request('/v1/deposit/usdc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ amount: 10, txHash: 'not-a-hash' }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /v1/deposit/houdini', () => {
    it('returns 401 without auth', async () => {
      const res = await app.request('/v1/deposit/houdini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId: 'q1', fromCoin: 'btc', amount: '0.001' }),
      })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /v1/balance', () => {
    it('returns 401 without auth', async () => {
      const res = await app.request('/v1/balance')
      expect(res.status).toBe(401)
    })
  })
})
