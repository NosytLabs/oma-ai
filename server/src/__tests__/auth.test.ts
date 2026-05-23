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
  const mockReturning = vi.fn().mockResolvedValue([{ id: 'user-1', address: '0xabc', nonce: 'nonce123', createdAt: new Date(), updatedAt: new Date() }])
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
  mockReturning.mockResolvedValue([{ id: 'user-1', address: '0xabc', nonce: 'nonce123', createdAt: new Date(), updatedAt: new Date() }])
  mockUpdate.mockReturnValue(chain)
  mockSet.mockReturnValue(chain)

  return { db: chain, getDb: () => chain }
})

vi.mock('../auth/api-keys.js', () => ({
  validateApiKey: vi.fn(),
  createApiKey: vi.fn().mockImplementation((_userId: string, name: string) =>
    Promise.resolve({
      key: 'oma_sk_testkey1234567890123456789012345678',
      prefix: 'oma_sk_test',
      id: 'key-1',
      name,
      createdAt: new Date(),
    })
  ),
  listApiKeys: vi.fn().mockResolvedValue([]),
  revokeApiKey: vi.fn(),
}))

vi.mock('../auth/siwe.js', () => ({
  verifySiweMessage: vi.fn(),
  getOrCreateUser: vi.fn().mockResolvedValue({ id: 'user-1', address: '0xabc123def456789012345678901234567890abcd', nonce: 'nonce123', createdAt: new Date(), updatedAt: new Date() }),
  getNonce: vi.fn().mockResolvedValue('nonce_abc123'),
  generateSessionToken: vi.fn().mockReturnValue('session.token.value'),
  verifySessionToken: vi.fn(),
}))

vi.mock('../credits/balance.js', () => ({
  getBalance: vi.fn().mockResolvedValue({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null }),
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  addCredits: vi.fn(),
}))

vi.mock('../credits/deposit.js', () => ({
  processUsdcDeposit: vi.fn(),
  processHoudiniDeposit: vi.fn(),
  completeHoudiniDeposit: vi.fn(),
}))

vi.mock('../credits/oracle.js', () => ({
  getOmaUsdPrice: vi.fn().mockResolvedValue(0.10),
}))

vi.mock('../credits/circuit-breaker.js', () => ({
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
import { verifySiweMessage, verifySessionToken } from '../auth/siwe.js'

describe('Auth Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /auth/nonce', () => {
    it('returns nonce with valid EVM address', async () => {
      const res = await app.request('/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: '0xABC123Def456789012345678901234567890abcd' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveProperty('nonce')
      expect(typeof body.nonce).toBe('string')
    })

    it('returns 400 with invalid address', async () => {
      const res = await app.request('/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: 'not-an-address' }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 with missing address', async () => {
      const res = await app.request('/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toContain('Validation error')
    })
  })

  describe('POST /auth/verify', () => {
    it('returns 400 with missing fields', async () => {
      const res = await app.request('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toContain('Validation error')
    })

    it('returns 400 with invalid type', async () => {
      const res = await app.request('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'msg', signature: 'sig', type: 'invalid' }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 401 when SIWE verification fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(verifySiweMessage).mockResolvedValueOnce(null as any)
      const res = await app.request('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'siwe-message', signature: '0xbadsig', type: 'siwe' }),
      })
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.type).toBe('authentication_error')
    })

    it('returns token on successful verification', async () => {
      vi.mocked(verifySiweMessage).mockResolvedValueOnce({
        address: '0xabc123def456789012345678901234567890abcd',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const res = await app.request('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'valid-siwe-message', signature: '0xvalidsig', type: 'siwe' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveProperty('token')
      expect(body).toHaveProperty('address')
    })
  })

  describe('POST /keys', () => {
    it('returns 401 without session', async () => {
      const res = await app.request('/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'my-key' }),
      })
      expect(res.status).toBe(401)
    })

    it('returns 400 with empty name', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      const res = await app.request('/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ name: '' }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 with name > 100 chars', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      const longName = 'a'.repeat(101)
      const res = await app.request('/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ name: longName }),
      })
      expect(res.status).toBe(400)
    })

    it('creates key with valid session and name', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      const res = await app.request('/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({ name: 'my-api-key' }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body).toHaveProperty('key')
      expect(body).toHaveProperty('prefix')
      expect(body).toHaveProperty('name', 'my-api-key')
    })
  })

  describe('GET /keys', () => {
    it('returns 401 without session', async () => {
      const res = await app.request('/keys')
      expect(res.status).toBe(401)
    })

    it('returns keys list with valid session', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce('user-1')
      const res = await app.request('/keys', {
        headers: { 'Authorization': 'Bearer session-token' },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveProperty('keys')
      expect(Array.isArray(body.keys)).toBe(true)
    })
  })
})
