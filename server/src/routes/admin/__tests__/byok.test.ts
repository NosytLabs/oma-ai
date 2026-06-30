import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { byokRoutes } from '../byok.js'

function makeApp() {
  const app = new Hono()
  app.route('/', byokRoutes)
  return app
}

describe('Admin BYOK routes (retired)', () => {
  beforeEach(() => {
    // no-op
  })

  it('returns 503 on list', async () => {
    const res = await makeApp().request('/admin/byok')
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.type).toBe('service_unavailable')
  })

  it('returns 503 on create', async () => {
    const res = await makeApp().request('/admin/byok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', key: 'sk-test', name: 'OpenAI Key' }),
    })
    expect(res.status).toBe(503)
  })

  it('returns 503 on delete', async () => {
    const res = await makeApp().request('/admin/byok/byok-1', { method: 'DELETE' })
    expect(res.status).toBe(503)
  })

  it('returns 503 on venice BYOK', async () => {
    const res = await makeApp().request('/admin/byok/venice', { method: 'POST' })
    expect(res.status).toBe(503)
  })

  it('returns 503 on ordering', async () => {
    const res = await makeApp().request('/admin/byok/ordering', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowFallbacks: true, preferredOrder: ['venice'] }),
    })
    expect(res.status).toBe(503)
  })
})
