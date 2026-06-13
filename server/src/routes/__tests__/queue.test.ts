import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { queueRoutes } from '../queue.js'

vi.mock('../../auth/middleware.js', () => ({
  bearerAuth: async (c: any, next: () => void) => {
    if (!c.req.header('Authorization')) {
      return c.json({ error: { message: 'Missing or invalid Authorization header', type: 'authentication_error' } }, 401)
    }
    c.set('userId', 'user-1')
    await next()
  },
}))

vi.mock('../../lib/request-queue.js', () => ({
  getQueueStats: vi.fn().mockResolvedValue({ depth: 2, avgWaitTimeMs: 100, oldestRequestAgeMs: 250 }),
  getQueueDepth: vi.fn().mockResolvedValue(2),
  MAX_QUEUE_DEPTH: 1000,
}))

import * as requestQueue from '../../lib/request-queue.js'

describe('Queue routes auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeApp() {
    const app = new Hono()
    app.route('/v1/queue', queueRoutes)
    return app
  }

  it('requires auth for queue stats', async () => {
    const res = await makeApp().request('/v1/queue/stats')

    expect(res.status).toBe(401)
    expect(requestQueue.getQueueStats).not.toHaveBeenCalled()
  })

  it('requires auth for queue depth', async () => {
    const res = await makeApp().request('/v1/queue/depth')

    expect(res.status).toBe(401)
    expect(requestQueue.getQueueDepth).not.toHaveBeenCalled()
  })

  it('returns queue stats when authenticated', async () => {
    const res = await makeApp().request('/v1/queue/stats', {
      headers: { Authorization: 'Bearer oma_sk_test' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ depth: 2, avgWaitTimeMs: 100, oldestRequestAgeMs: 250 })
    expect(requestQueue.getQueueStats).toHaveBeenCalledTimes(1)
  })

  it('returns queue depth when authenticated', async () => {
    const res = await makeApp().request('/v1/queue/depth', {
      headers: { Authorization: 'Bearer oma_sk_test' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ depth: 2, maxDepth: 1000 })
    expect(requestQueue.getQueueDepth).toHaveBeenCalledTimes(1)
  })
})
