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

  const { searchParams } = new URL(request.url)
  const page = Math.min(parseInt(searchParams.get('page') || '1', 10), 100)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const search = searchParams.get('search')?.slice(0, 200) || ''

  try {
    const res = await fetch(`${API_URL}/v1/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
      headers: { 'Authorization': authorization },
      cache: 'no-store',
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({}))
      return NextResponse.json(error, { status: res.status, headers: rateLimit.headers })
    }

    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { headers: rateLimit.headers })
  } catch (err) {
    console.error('Admin users proxy error:', err)
    if (err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('ECONNREFUSED'))) {
      return NextResponse.json({ error: { message: 'Backend unavailable', type: 'backend_unavailable' } }, { status: 503, headers: rateLimit.headers })
    }
    return NextResponse.json({ error: { message: 'Internal server error', type: 'internal_server_error' } }, { status: 500, headers: rateLimit.headers })
  }
}
