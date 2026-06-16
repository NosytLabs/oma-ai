import { describe, it, expect } from 'vitest'
import { getAdminAuthorization, unauthorizedAdminResponse } from './auth'

describe('getAdminAuthorization', () => {
  it('returns the Authorization header verbatim when present', () => {
    const request = new Request('http://localhost', {
      headers: { Authorization: 'Bearer custom-token' },
    })
    expect(getAdminAuthorization(request)).toBe('Bearer custom-token')
  })

  it('falls back to a Bearer token derived from the oma_session cookie', () => {
    const request = new Request('http://localhost', {
      headers: { cookie: 'oma_session=session-token; other=value' },
    })
    expect(getAdminAuthorization(request)).toBe('Bearer session-token')
  })

  it('returns null when neither Authorization header nor oma_session cookie is present', () => {
    const request = new Request('http://localhost', {
      headers: { cookie: 'other=value' },
    })
    expect(getAdminAuthorization(request)).toBeNull()
  })

  it('returns null when no cookie header is provided at all', () => {
    const request = new Request('http://localhost')
    expect(getAdminAuthorization(request)).toBeNull()
  })
})

describe('unauthorizedAdminResponse', () => {
  it('returns a 401 response with the standard error envelope', async () => {
    const response = unauthorizedAdminResponse()
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBeDefined()
    expect(typeof body.error.message).toBe('string')
  })
})
