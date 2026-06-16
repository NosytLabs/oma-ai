/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from 'vitest'

// The route uses a rate-limit helper that is currently in flux between two
// signatures (`rateLimitMiddleware(request)` vs `checkRateLimit(request, ...)`).
// Mock BOTH possible export names so the test focuses on the route's
// user-listing / pagination / error-handling logic regardless of which
// signature the production code lands on.
vi.mock('../rate-limit', () => ({
  rateLimitMiddleware: () => null,
  checkRateLimit: () => ({ allowed: true as const, headers: {} }),
}))

import { GET } from './route'

describe('GET /api/admin/users', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 401 when no oma_session cookie is present and no Authorization header is set', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch')

    const response = await GET(new Request('http://localhost/api/admin/users'))

    expect(response.status).toBe(401)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 503 when the upstream fetch fails with a network error (ECONNREFUSED)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(
      new TypeError('fetch failed: ECONNREFUSED 127.0.0.1:3001')
    )

    const request = new Request('http://localhost/api/admin/users', {
      headers: { cookie: 'oma_session=admin-token' },
    })

    const response = await GET(request as any)

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.error.message).toBe('Backend unavailable')
  })

  it('forwards the Authorization header derived from the oma_session cookie', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ users: [], pagination: { page: 1, limit: 50, total: 0 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const request = new Request('http://localhost/api/admin/users', {
      headers: { cookie: 'oma_session=admin-token' },
    })

    await GET(request as any)

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/v1/admin/users'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer admin-token',
        }),
      })
    )
  })

  it('paginates with limit and page params (URL-encoded into the upstream request)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ users: [], pagination: { page: 2, limit: 10, total: 0 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const request = new Request('http://localhost/api/admin/users?page=2&limit=10', {
      headers: { cookie: 'oma_session=admin-token' },
    })

    await GET(request as any)

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/page=2&limit=10/),
      expect.any(Object)
    )
  })

  it('URL-encodes the search parameter to prevent injection', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const request = new Request('http://localhost/api/admin/users?search=foo%20bar%26baz', {
      headers: { cookie: 'oma_session=admin-token' },
    })

    await GET(request as any)

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '')
    expect(calledUrl).toContain('search=foo%20bar%26baz')
  })

  it('caps page at 100 and limit at 200', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ users: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const request = new Request('http://localhost/api/admin/users?page=9999&limit=9999', {
      headers: { cookie: 'oma_session=admin-token' },
    })

    await GET(request as any)

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/page=100&limit=200/),
      expect.any(Object)
    )
  })

  it('passes through upstream error responses with their status code', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'forbidden' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const request = new Request('http://localhost/api/admin/users', {
      headers: { cookie: 'oma_session=admin-token' },
    })

    const response = await GET(request as any)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.message).toBe('forbidden')
  })
})
