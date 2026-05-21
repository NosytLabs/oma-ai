import { describe, it, expect, vi } from 'vitest'

vi.mock('@hono/node-server', () => ({
  serve: vi.fn(),
}))

vi.mock('../config.js', () => ({
  config: {
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars-long-for-hmac',
    NODE_ENV: 'test',
  },
}))

vi.mock('../credits/balance.js', () => ({
  addCredits: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../db/client.js', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  mockChain.select.mockReturnValue(mockChain);
  mockChain.from.mockReturnValue(mockChain);
  mockChain.where.mockReturnValue(mockChain);
  mockChain.limit.mockReturnValue(mockChain);
  mockChain.insert.mockReturnValue(mockChain);
  mockChain.values.mockReturnValue(mockChain);
  mockChain.update.mockReturnValue(mockChain);
  mockChain.set.mockReturnValue(mockChain);
  mockChain.delete.mockReturnValue(mockChain);
  return {
    getDb: vi.fn(),
    db: mockChain,
  };
})

vi.mock('../auth/api-keys.js', () => ({
  validateApiKey: vi.fn().mockResolvedValue({ id: 'key-1', userId: 'user-test', keyPrefix: 'oma', keyHash: 'hash', name: 'test', active: true, createdAt: new Date() }),
}))

vi.mock('../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
  tokenBucket: () => async (_c: unknown, next: () => void) => next(),
  modelRateLimit: () => async (_c: unknown, next: () => void) => next(),
  burstRateLimit: () => async (_c: unknown, next: () => void) => next(),
  expressiveRateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

import app from '../index.js'

describe('Fiat Onramp Routes', () => {
  function authHeaders() {
    return { Authorization: 'Bearer oma_test-key-testing' }
  }

  describe('POST /v1/onramp/quote', () => {
    it('returns quote for valid USD amount', async () => {
      const res = await app.request('/v1/onramp/quote', {
        method: 'POST',
        body: JSON.stringify({ amountUsd: 100 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.credits).toBeGreaterThan(0)
      expect(body.rate).toBe(100)
    })

    it('returns 400 for amount below minimum', async () => {
      const res = await app.request('/v1/onramp/quote', {
        method: 'POST',
        body: JSON.stringify({ amountUsd: 1 }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for amount above maximum', async () => {
      const res = await app.request('/v1/onramp/quote', {
        method: 'POST',
        body: JSON.stringify({ amountUsd: 9999 }),
      })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /v1/onramp/session', () => {
    it('creates a session with valid auth and amount', async () => {
      const res = await app.request('/v1/onramp/session', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amountUsd: 50 }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.sessionId).toBeDefined()
      expect(body.status).toBe('pending')
      expect(body.credits).toBeGreaterThan(0)
    })

    it('returns 401 without auth', async () => {
      const res = await app.request('/v1/onramp/session', {
        method: 'POST',
        body: JSON.stringify({ amountUsd: 50 }),
      })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /v1/onramp/session/:id', () => {
    it('returns session status for valid id', async () => {
      const create = await app.request('/v1/onramp/session', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amountUsd: 25 }),
      })
      const { sessionId } = await create.json()

      const res = await app.request(`/v1/onramp/session/${sessionId}`, {
        method: 'GET',
        headers: authHeaders(),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.sessionId).toBe(sessionId)
      expect(body.status).toBe('pending')
    })

    it('returns 404 for unknown session', async () => {
      const res = await app.request('/v1/onramp/session/unknown-id', {
        method: 'GET',
        headers: authHeaders(),
      })
      expect(res.status).toBe(404)
    })
  })

  describe('POST /v1/onramp/webhook', () => {
    it('completes a pending session with valid signature', async () => {
      const create = await app.request('/v1/onramp/session', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amountUsd: 25 }),
      })
      const { sessionId } = await create.json()

      const body = JSON.stringify({ sessionId })
      const crypto = await import('node:crypto')
      const secret = 'test-jwt-secret-that-is-at-least-32-chars-long-for-hmac'
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')

      const res = await app.request('/v1/onramp/webhook', {
        method: 'POST',
        body,
        headers: { 'X-Onramp-Signature': signature, 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(200)
      const result = await res.json()
      expect(result.credits).toBeGreaterThan(0)
      expect(result.status).toBe('completed')
    })

    it('returns 401 for invalid signature', async () => {
      const res = await app.request('/v1/onramp/webhook', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'test' }),
        headers: { 'X-Onramp-Signature': 'invalid', 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(401)
    })

    it('returns 404 for unknown session', async () => {
      const body = JSON.stringify({ sessionId: 'nonexistent' })
      const crypto = await import('node:crypto')
      const secret = 'test-jwt-secret-that-is-at-least-32-chars-long-for-hmac'
      const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')

      const res = await app.request('/v1/onramp/webhook', {
        method: 'POST',
        body,
        headers: { 'X-Onramp-Signature': signature, 'Content-Type': 'application/json' },
      })
      expect(res.status).toBe(404)
    })
  })
})
