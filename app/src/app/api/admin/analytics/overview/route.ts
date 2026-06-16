import { NextRequest, NextResponse } from 'next/server'
import { API_URL } from '@/lib/api/admin-config'
import { getAdminAuthorization, unauthorizedAdminResponse } from '../../auth'
import { checkRateLimit } from '../../rate-limit'

export async function GET(request: NextRequest) {
  const authorization = getAdminAuthorization(request)
  if (!authorization) return unauthorizedAdminResponse()

  const rateLimit = checkRateLimit(request, authorization)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { message: 'Rate limit exceeded', type: 'rate_limit_exceeded' } },
      { status: 429, headers: rateLimit.headers }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const period = searchParams.get('period') || '30d'

  try {
    const response = await fetch(`${API_URL}/v1/admin/analytics/overview?period=${period}`, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return NextResponse.json(error, { status: response.status, headers: rateLimit.headers })
    }

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { headers: rateLimit.headers })
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch analytics data', type: 'upstream_error' } },
      { status: 500, headers: rateLimit.headers }
    )
  }
}
