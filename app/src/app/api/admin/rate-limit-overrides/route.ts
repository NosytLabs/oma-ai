import { NextResponse } from 'next/server'

import { getAdminAuthorization, unauthorizedAdminResponse } from '../auth'
import { checkRateLimit } from '../rate-limit'
import { API_URL } from '@/lib/api/admin-config'

export async function GET(request: Request) {
  const authorization = getAdminAuthorization(request)
  if (!authorization) return unauthorizedAdminResponse()

  const rateLimit = checkRateLimit(request, authorization)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { message: 'Rate limit exceeded', type: 'rate_limit_exceeded' } },
      { status: 429, headers: rateLimit.headers }
    )
  }

  try {
    const res = await fetch(`${API_URL}/v1/admin/rate-limit-overrides`, {
      headers: { Authorization: authorization },
      cache: 'no-store',
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      return NextResponse.json(error, { status: res.status, headers: rateLimit.headers })
    }

    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { headers: rateLimit.headers })
  } catch (err) {
    console.error('Get rate limit overrides error:', err)
    return NextResponse.json({ error: { message: 'Internal server error', type: 'internal_server_error' } }, { status: 500, headers: rateLimit.headers })
  }
}

export async function POST(request: Request) {
  const authorization = getAdminAuthorization(request)
  if (!authorization) return unauthorizedAdminResponse()

  const rateLimit = checkRateLimit(request, authorization)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { message: 'Rate limit exceeded', type: 'rate_limit_exceeded' } },
      { status: 429, headers: rateLimit.headers }
    )
  }

  try {
    const body = await request.json()
    const res = await fetch(`${API_URL}/v1/admin/rate-limit-overrides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      return NextResponse.json(error, { status: res.status, headers: rateLimit.headers })
    }

    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: 201, headers: rateLimit.headers })
  } catch (err) {
    console.error('Create rate limit override error:', err)
    return NextResponse.json({ error: { message: 'Internal server error', type: 'internal_server_error' } }, { status: 500, headers: rateLimit.headers })
  }
}

export async function DELETE(request: Request) {
  const authorization = getAdminAuthorization(request)
  if (!authorization) return unauthorizedAdminResponse()

  const rateLimit = checkRateLimit(request, authorization)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { message: 'Rate limit exceeded', type: 'rate_limit_exceeded' } },
      { status: 429, headers: rateLimit.headers }
    )
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: { message: 'Override ID required', type: 'validation_error' } }, { status: 400, headers: rateLimit.headers })
  }

  try {
    const res = await fetch(`${API_URL}/v1/admin/rate-limit-overrides/${id}`, {
      method: 'DELETE',
      headers: { Authorization: authorization },
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      return NextResponse.json(error, { status: res.status, headers: rateLimit.headers })
    }

    return NextResponse.json({ success: true }, { headers: rateLimit.headers })
  } catch (err) {
    console.error('Delete rate limit override error:', err)
    return NextResponse.json({ error: { message: 'Internal server error', type: 'internal_server_error' } }, { status: 500, headers: rateLimit.headers })
  }
}
