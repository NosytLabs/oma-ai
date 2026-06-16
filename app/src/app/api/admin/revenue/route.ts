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
  const validPeriods = ['24h', '7d', '30d', '90d', 'all']
  const period = validPeriods.includes(searchParams.get('period') || '') ? searchParams.get('period') : '30d'

  try {
    const res = await fetch(`${API_URL}/v1/admin/revenue?period=${period}`, {
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
    console.error('Admin revenue proxy error:', err)
    return NextResponse.json({ error: { message: 'Internal server error', type: 'internal_server_error' } }, { status: 500, headers: rateLimit.headers })
  }
}
