import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from '../routes/admin'
import { db } from '../db/client'
import { eq as _eq } from 'drizzle-orm'

// Mock db
vi.mock('../db/client', () => {
  const mDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  }
  return { db: mDb }
})

// Bypass sessionAuth for tests
vi.mock('../auth/middleware', () => ({
  sessionAuth: async (c: any, next: any) => {
    c.set('userId', 'admin123')
    await next()
  },
  requireAdmin: () => async (c: any, next: any) => {
    // Mock requires DB interaction - set teamRole directly for test
    c.set('teamRole', 'owner')
    await next()
  },
  initAuth: () => {}
}))

vi.mock('../config', () => ({
  config: {
    ADMIN_WALLET_ADDRESSES: 'admin-addr'
  }
}))

vi.mock('../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

describe('Admin Routes Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('caps the limit to 100 for /admin/users', async () => {
    // Create a chainable mock that supports the Drizzle query chain
    const createChainableMock = (resolvedValue: any) => {
      const mock: any = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(resolvedValue),
      }
      return mock
    }

    // Mock users query (empty result)
    const usersMock = createChainableMock([])

    // Mock total count
    const countMock = createChainableMock([{ count: 0 }])

    let callCount = 0
    ;(db.select as any).mockImplementation(() => {
      callCount++
      if (callCount === 1) return usersMock
      return countMock
    })

    const app = new Hono()
    app.route('/', adminRoutes)

    const res = await app.request('/admin/users?limit=5000')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.pagination.limit).toBe(50)
  })

  it('caps the limit to 100 for /admin/keys', async () => {
    // Create a chainable mock that supports the Drizzle query chain
    const createChainableMock = (resolvedValue: any) => {
      const mock: any = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue(resolvedValue),
      }
      return mock
    }

    // Mock keys query (empty result)
    const keysMock = createChainableMock([])

    // Mock total count
    const countMock = createChainableMock([{ count: 0 }])

    let callCount = 0
    ;(db.select as any).mockImplementation(() => {
      callCount++
      if (callCount === 1) return keysMock
      return countMock
    })

    const app = new Hono()
    app.route('/', adminRoutes)

    const res = await app.request('/admin/keys?limit=250')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.pagination.limit).toBe(100)
  })
})