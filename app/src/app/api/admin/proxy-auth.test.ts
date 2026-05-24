import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET as getFees } from './config/fees/route'
import { GET as getKeys } from './keys/route'

describe('admin proxy auth', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('forwards the oma_session cookie for config GET requests', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const request = new Request('http://localhost/api/admin/config/fees', {
      headers: { cookie: 'oma_session=session-token; other=value' },
    })

    await getFees(request)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/v1/admin/config/fees',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token',
        }),
      })
    )
  })

  it('returns 401 when no oma_session cookie is present for config GET requests', async () => {
    const fetchMock = vi.spyOn(global, 'fetch')

    const response = await getFees(new Request('http://localhost/api/admin/config/fees'))

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards the oma_session cookie for admin list GET requests', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ keys: [], pagination: { page: 1, total: 0, limit: 100 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const request = new Request('http://localhost/api/admin/keys?limit=100', {
      headers: { cookie: 'other=value; oma_session=session-token' },
    })

    await getKeys(request)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/admin/keys?page=1&limit=100',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer session-token',
        }),
      })
    )
  })
})
