/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL = process.env.CHAT_PROXY_ENABLED

const loadRoute = async () => {
  vi.resetModules()
  return import('./route')
}

describe('POST /api/v1/chat/completions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.CHAT_PROXY_ENABLED
    } else {
      process.env.CHAT_PROXY_ENABLED = ORIGINAL
    }
  })

  it('returns 503 with a retry-after header when CHAT_PROXY_ENABLED is not "true"', async () => {
    delete process.env.CHAT_PROXY_ENABLED
    const fetchSpy = vi.spyOn(global, 'fetch')
    const { POST } = await loadRoute()

    const request = new Request('http://localhost/api/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'llama', messages: [] }),
    })

    const response = await POST(request as any)

    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('3600')
    const body = await response.json()
    expect(body.error.code).toBe('chat_proxy_disabled')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 502 when the upstream fetch throws (proxy_enabled path)', async () => {
    process.env.CHAT_PROXY_ENABLED = 'true'
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockRejectedValue(new TypeError('fetch failed: ECONNREFUSED'))
    const { POST } = await loadRoute()

    const request = new Request('http://localhost/api/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'llama', messages: [{ role: 'user', content: 'hi' }] }),
    })

    const response = await POST(request as any)

    expect(response.status).toBe(502)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const body = await response.json()
    expect(body.error.code).toBe('upstream_unreachable')
  })

  it('forwards the upstream JSON body and status when upstream responds OK', async () => {
    process.env.CHAT_PROXY_ENABLED = 'true'
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'x', choices: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Provider': 'openrouter' },
      })
    )
    const { POST } = await loadRoute()

    const request = new Request('http://localhost/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'llama', messages: [] }),
    })

    const response = await POST(request as any)

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Provider')).toBe('openrouter')
    const body = await response.json()
    expect(body.id).toBe('x')
  })

  it('forwards the request body and method to the upstream', async () => {
    process.env.CHAT_PROXY_ENABLED = 'true'
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    )
    const { POST } = await loadRoute()

    const payload = { model: 'llama', messages: [{ role: 'user', content: 'hi' }] }
    const request = new Request('http://localhost/api/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    await POST(request as any)

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [RequestInfo | string, RequestInit]
    expect(String(calledUrl)).toBe('http://localhost:3001/v1/chat/completions')
    expect(calledInit.method).toBe('POST')
    expect(calledInit.cache).toBe('no-store')
    const bodyBytes = new Uint8Array(calledInit.body as ArrayBuffer)
    const bodyText = new TextDecoder().decode(bodyBytes)
    expect(bodyText).toBe(JSON.stringify(payload))
  })
})
