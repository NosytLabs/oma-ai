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
  createApiKey: vi.fn(),
  listApiKeys: vi.fn().mockResolvedValue([]),
  revokeApiKey: vi.fn(),
  getApiKey: vi.fn(),
  createApiKeyCookieHeader: vi.fn((apiKey: string) => `oma_api_key=${apiKey}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`),
  createLogoutCookieHeader: vi.fn(() => "oma_api_key=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"),
}))

vi.mock('../auth/siwe.js', () => ({
  verifySiweMessage: vi.fn(),
  getOrCreateUser: vi.fn().mockResolvedValue({ id: 'user-1', address: '0xabc123def456789012345678901234567890abcd', nonce: 'nonce123', createdAt: new Date(), updatedAt: new Date() }),
  getNonce: vi.fn().mockResolvedValue('nonce_abc123'),
  generateSessionToken: vi.fn().mockResolvedValue('session.token.value'),
  verifySessionToken: vi.fn(),
}))

vi.mock('../credits/index.js', () => ({
  getBalance: vi.fn().mockResolvedValue({ balanceCents: '1000', totalDepositedCents: '1000', totalUsedCents: '0', lastActivityAt: null }),
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  addCredits: vi.fn(),
}))

vi.mock('../credits/deposit.js', () => ({
  processUsdcDeposit: vi.fn(),
}))

vi.mock('../credits/oracle.js', () => ({
  getOmaUsdPrice: vi.fn().mockResolvedValue(0.10),
}))

vi.mock('../inference/circuit-breaker.js', () => ({
  checkCircuitBreaker: vi.fn().mockResolvedValue({ omaDepositsAllowed: true, omaBonusPercent: 5, reason: null }),
  checkOracleCircuitBreaker: vi.fn().mockResolvedValue(false),
}))

vi.mock('../inference/router.js', () => ({
  handleChatCompletion: vi.fn(),
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
  },
}))

import app from '../index.js'
import { verifySessionToken } from '../auth/siwe.js'

describe('API Key Cookie Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /auth/api-key/cookie', () => {
    it('returns 401 without session', async () => {
      const res = await app.request('/auth/api-key/cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'oma_sk_testkey123' }),
      })
      expect(res.status).toBe(401)
    })

    it('returns 400 without apiKey in body', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })
      const res = await app.request('/auth/api-key/cookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer session-token',
        },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    it('sets httpOnly cookie with API key and returns success', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })
const { validateApiKey } = await import('../auth/api-keys.js');
vi.mocked(validateApiKey).mockResolvedValueOnce({ userId: 'user-1', id: 'key-1', keyPrefix: 'oma_sk', active: true } as any)

      const res = await app.request('/auth/api-key/cookie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-session-token',
        },
        body: JSON.stringify({ apiKey: 'oma_sk_testkey1234567890123456789012345678' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)

      const setCookie = res.headers.get('Set-Cookie')
      expect(setCookie).toBeTruthy()
      expect(setCookie).toContain('oma_api_key=')
      expect(setCookie).toContain('HttpOnly')
      expect(setCookie).toContain('SameSite=Strict')
    })
  })

  describe('DELETE /auth/api-key/cookie', () => {
    it('clears the API key cookie', async () => {
      vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: 'user-1', authMethod: 'siwe' })

      const res = await app.request('/auth/api-key/cookie', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer valid-session-token',
        },
      })

      expect(res.status).toBe(200)
      const setCookie = res.headers.get('Set-Cookie')
      expect(setCookie).toContain('oma_api_key=')
      expect(setCookie).toContain('Max-Age=0')
    })
  })
})