import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ---------------------------------------------------------------------------
// MOCKS — keep these BEFORE the route import (vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock('../db/client.js', () => {
  const mDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }
  return { db: mDb }
})

vi.mock('../auth/middleware.js', () => ({
  sessionAuth: async (_c: any, next: any) => {
    _c.set('userId', 'admin123')
    await next()
  },
  requireAdmin: () => async (_c: any, next: any) => {
    _c.set('teamRole', 'owner')
    await next()
  },
}))

vi.mock('../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
  },
}))

// ---------------------------------------------------------------------------
// IMPORTS — must come AFTER vi.mock calls
// ---------------------------------------------------------------------------

import { configRoutes } from '../routes/config.js'
import { db } from '../db/client.js'

const VALID_FEE_PAYLOAD = {
  config: {
    providers: {
      venice: { markupPercent: 15 },
      surplus: { markupPercent: 20 },
    },
  },
}

const VALID_RATE_LIMIT_OVERRIDE = {
  targetType: 'user',
  targetId: '11111111-1111-4111-8111-111111111111',
  rpm: 120,
  tpm: 50000,
}

function setupEmptyDbSelect() {
  vi.clearAllMocks()
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  }
  chain.limit.mockResolvedValue([])
  ;(db.select as any).mockReturnValue(chain)
}

// ---------------------------------------------------------------------------
// TEST SUITE — request validation behavior
// ---------------------------------------------------------------------------

describe('Config routes — validation behavior', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', configRoutes)
    setupEmptyDbSelect()
  })

  describe('PUT /v1/admin/config/fees', () => {
    it('returns 400 with details when the body is malformed', async () => {
      const res = await app.request('/v1/admin/config/fees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { providers: { venice: { markupPercent: 'not-a-number' } } } }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toMatch(/Invalid config format/)
      expect(body.error.details).toBeDefined()
      expect(Array.isArray(body.error.details)).toBe(true)
      expect(body.error.details.length).toBeGreaterThan(0)
    })

    it('returns 200 for a valid fee config payload', async () => {
      const res = await app.request('/v1/admin/config/fees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_FEE_PAYLOAD),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.config.providers.venice.markupPercent).toBe(15)
    })
  })

  describe('PUT /v1/admin/config/rate-limits', () => {
    it('returns 400 with details when the body is malformed', async () => {
      const res = await app.request('/v1/admin/config/rate-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { tiers: { free: { rpm: 'lots' } } } }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toMatch(/Invalid config format/)
      expect(body.error.details).toBeDefined()
      expect(Array.isArray(body.error.details)).toBe(true)
      expect(body.error.details.length).toBeGreaterThan(0)
    })

    it('returns 200 for a valid rate-limit config payload', async () => {
      const payload = {
        config: {
          tiers: {
            free: { rpm: 60, tpm: 10000 },
          },
        },
      }
      const res = await app.request('/v1/admin/config/rate-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.config.tiers.free.rpm).toBe(60)
    })
  })

  describe('POST /v1/admin/rate-limit-overrides', () => {
    it('returns 400 with details when the body is malformed', async () => {
      const res = await app.request('/v1/admin/rate-limit-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'invalid', targetId: 'not-a-uuid' }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.message).toMatch(/Invalid override format/)
      expect(body.error.details).toBeDefined()
      expect(Array.isArray(body.error.details)).toBe(true)
      expect(body.error.details.length).toBeGreaterThan(0)
    })

    it('returns 201 for a valid rate-limit override payload', async () => {
      ;(db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: '22222222-2222-4222-8222-222222222222',
            ...VALID_RATE_LIMIT_OVERRIDE,
            expiresAt: null,
            createdAt: new Date(),
          }]),
        }),
      })

      const res = await app.request('/v1/admin/rate-limit-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(VALID_RATE_LIMIT_OVERRIDE),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.override.targetType).toBe('user')
    })
  })
})
