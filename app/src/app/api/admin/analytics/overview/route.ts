import { NextRequest, NextResponse } from 'next/server'
import { API_URL } from '@/lib/api/admin-config'
import { getAdminAuthorization, unauthorizedAdminResponse } from '../../auth'
import { rateLimitMiddleware } from '../../rate-limit'

export async function GET(request: NextRequest) {
  const rateLimitResponse = rateLimitMiddleware(request)
  if (rateLimitResponse) return rateLimitResponse

  const searchParams = request.nextUrl.searchParams
  const period = searchParams.get('period') || '30d'

  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const response = await fetch(`${API_URL}/v1/admin/analytics/overview?period=${period}`, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(error, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch analytics data' } },
      { status: 500 }
    )
  }
}