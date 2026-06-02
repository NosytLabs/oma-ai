import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

vi.mock('../../../db/client.js', () => ({
  db: {
    select: vi.fn(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
  },
  getDb: () => ({}),
}))

vi.mock('../../../auth/middleware', () => ({
  sessionAuth: async (c: any, next: any) => {
    c.set('userId', 'admin123')
    c.set('teamRole', 'owner')
    await next()
  },
  requireAdmin: () => async (c: any, next: any) => {
    c.set('teamRole', 'owner')
    await next()
  }
}))

vi.mock('../../../inference/openrouter.js', () => ({
  createBYOKKey: vi.fn(),
  listBYOKKeys: vi.fn(),
  deleteBYOKKey: vi.fn(),
  addVeniceAsBYOK: vi.fn(),
  configureBYOKOrdering: vi.fn(),
}))

vi.mock('../../../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

vi.mock('../../../config.js', () => ({
  config: {
    OPENROUTER_API_KEY: 'sk-or-test',
    OPENROUTER_API_URL: 'https://openrouter.ai/api/v1',
    VENICE_API_KEY: 'sk-venice-test',
  },
}))

import { db } from '../../../db/client.js'
import * as openrouter from '../../../inference/openrouter.js'
import { byokRoutes } from '../byok.js'

function makeApp() {
  const app = new Hono()
  app.route('/', byokRoutes)
  return app
}

function makeSelectChainableMock(resolvedValue: unknown) {
  const mock: Record<string, unknown> = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(resolvedValue),
  }
  return mock
}

describe('Admin BYOK routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists BYOK keys from OpenRouter and DB', async () => {
    vi.mocked(openrouter.listBYOKKeys).mockResolvedValueOnce([
      { id: 'byok-1', provider: 'venice', name: 'Venice AI', createdAt: '2024-01-01T00:00:00Z' },
    ] as any)

    const totalMock = makeSelectChainableMock([{ count: 0 }])
    const cachedMock = makeSelectChainableMock([])

    let callCount = 0
    ;(db.select as any).mockImplementation(() => {
      callCount++
      if (callCount === 1) return totalMock
      return cachedMock
    })

    const res = await makeApp().request('/admin/byok')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.keys).toEqual([
      { id: 'byok-1', provider: 'venice', name: 'Venice AI', createdAt: '2024-01-01T00:00:00Z' },
    ])
    expect(body.cached).toEqual([])
    expect(body.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 0,
      pages: 0,
    })
  })

  it('returns 200 with empty list when listBYOKKeys throws', async () => {
    vi.mocked(openrouter.listBYOKKeys).mockRejectedValueOnce(new Error('Upstream down'))

    const totalMock = makeSelectChainableMock([{ count: 0 }])
    const cachedMock = makeSelectChainableMock([])

    let callCount = 0
    ;(db.select as any).mockImplementation(() => {
      callCount++
      if (callCount === 1) return totalMock
      return cachedMock
    })

    const res = await makeApp().request('/admin/byok')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.keys).toEqual([])
  })

  it('creates a BYOK key and persists it locally', async () => {
    vi.mocked(openrouter.createBYOKKey).mockResolvedValueOnce({
      id: 'byok-2',
      provider: 'openai',
      name: 'OpenAI Key',
      createdAt: '2024-01-02T00:00:00Z',
    } as any)

    const res = await makeApp().request('/admin/byok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', key: 'sk-test', name: 'OpenAI Key' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe('byok-2')
    expect(body.provider).toBe('openai')
  })

  it('validates BYOK creation payload', async () => {
    const res = await makeApp().request('/admin/byok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: '', key: '', name: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('deletes a BYOK key from both OpenRouter and DB', async () => {
    vi.mocked(openrouter.deleteBYOKKey).mockResolvedValueOnce(undefined)

    const res = await makeApp().request('/admin/byok/byok-1', { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.deleted).toBe(true)
  })

  it('configures BYOK ordering', async () => {
    vi.mocked(openrouter.configureBYOKOrdering).mockResolvedValueOnce({ success: true })

    const res = await makeApp().request('/admin/byok/ordering', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowFallbacks: true, preferredOrder: ['venice', 'openrouter'] }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns error when BYOK ordering fails', async () => {
    vi.mocked(openrouter.configureBYOKOrdering).mockResolvedValueOnce({
      success: false,
      error: 'Bad config',
    })

    const res = await makeApp().request('/admin/byok/ordering', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowFallbacks: true, preferredOrder: ['venice'] }),
    })
    expect(res.status).toBe(502)
  })

  it('adds Venice as BYOK', async () => {
    vi.mocked(openrouter.addVeniceAsBYOK).mockResolvedValueOnce({
      success: true,
      byokKey: { id: 'byok-venice', provider: 'venice', name: 'Venice AI (BYOK)', createdAt: '2024-01-01' } as any,
    })

    const res = await makeApp().request('/admin/byok/venice', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.byokKey.id).toBe('byok-venice')
  })
})
