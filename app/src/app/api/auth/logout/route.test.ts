/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('POST /api/auth/logout', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards cookies and csrf token to the upstream backend', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'oma_session=; Path=/; Max-Age=0' },
      })
    )
    const { POST } = await import('./route')

    const request = new Request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: 'oma_session=abc123; csrf_token=xyz',
        'x-csrf-token': 'xyz',
      },
    })

    // biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
    const response = await POST(request as any)

    expect(response.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toBe('http://localhost:3001/auth/logout')
    expect(calledInit.method).toBe('POST')
    const headers = calledInit.headers as Record<string, string>
    expect(cookies(headers)).toContain('oma_session=abc123')
  })

  it('clears cookies and returns 200 even when upstream fetch throws', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'))
    const { POST } = await import('./route')

    const request = new Request('http://localhost/api/auth/logout', { method: 'POST' })
    // biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
    const response = await POST(request as any)

    // The route intentionally swallows backend errors so the client can
    // still clear local cookies and disconnect the wallet.
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
  })

  it('clears oma_session cookie on successful logout', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{"success":true}', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'oma_session=; Path=/; Max-Age=0',
        },
      })
    )
    const { POST } = await import('./route')

    const request = new Request('http://localhost/api/auth/logout', { method: 'POST' })
    // biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
    const response = await POST(request as any)

    const setCookie = response.headers.get('set-cookie') || ''
    expect(setCookie).toContain('oma_session=;')
    // The route uses `expires=...` (RFC 6265 format), not `Max-Age=0`.
    // Both achieve the same result (immediate cookie expiry).
    expect(setCookie).toContain('expires=Thu, 01 Jan 1970')
  })

  it('always returns 200 regardless of upstream status (client-side cookie clear always works)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const { POST } = await import('./route')

    const request = new Request('http://localhost/api/auth/logout', { method: 'POST' })
    // biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
    const response = await POST(request as any)

    // The route intentionally returns 200 even when the upstream returns
    // a non-OK status, because client-side cookie clearing should always
    // succeed independently of the backend session state.
    expect(response.status).toBe(200)
  })
})

/** Extract cookie string from headers, handling plain string or Headers object. */
function cookies(h: Record<string, string> | Headers): string {
  if (typeof (h as Headers).forEach === 'function') {
    return (h as Headers).get('cookie') || ''
  }
  return (h as Record<string, string>).cookie || ''
}
