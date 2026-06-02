import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { surplusRoutes } from '../surplus'

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

vi.mock('../../../inference/surplus.js', () => ({
  surplusListModels: vi.fn(),
  surplusHealthCheck: vi.fn(),
  surplusChatCompletion: vi.fn(),
}))

vi.mock('../../../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

import * as surplus from '../../../inference/surplus.js'

describe('Admin Surplus routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeApp() {
    const app = new Hono()
    app.route('/', surplusRoutes)
    return app
  }

  it('lists Surplus models', async () => {
    vi.mocked(surplus.surplusListModels).mockResolvedValueOnce({
      object: 'list',
      data: [
        {
          id: 'surplus-deepseek-r1',
          object: 'model',
          created: 1700000000,
          display_name: 'DeepSeek R1',
          description: 'Surplus deepseek',
          context_length: 65536,
          supported_parameters: ['temperature'],
          pricing: { input: 0.5, output: 1.5 },
        },
      ],
    } as any)

    const res = await makeApp().request('/admin/surplus/models')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].id).toBe('surplus-deepseek-r1')
  })

  it('returns upstream status when listing models fails', async () => {
    vi.mocked(surplus.surplusListModels).mockRejectedValueOnce(
      Object.assign(new Error('Surplus unreachable'), { status: 502 })
    )

    const res = await makeApp().request('/admin/surplus/models')
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error.message).toContain('Surplus')
  })

  it('returns Surplus health check result', async () => {
    vi.mocked(surplus.surplusHealthCheck).mockResolvedValueOnce({
      isUp: true,
      latencyMs: 100,
    })

    const res = await makeApp().request('/admin/surplus/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isUp).toBe(true)
    expect(typeof body.latencyMs).toBe('number')
  })

  it('returns 502 when Surplus health check throws', async () => {
    vi.mocked(surplus.surplusHealthCheck).mockRejectedValueOnce(new Error('boom'))

    const res = await makeApp().request('/admin/surplus/health')
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.isUp).toBe(false)
  })
})
