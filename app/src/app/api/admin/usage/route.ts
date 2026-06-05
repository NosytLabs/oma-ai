import { NextResponse } from 'next/server'
import { getAdminAuthorization, unauthorizedAdminResponse } from '../auth'
import { rateLimitMiddleware } from '../rate-limit'
import { API_URL } from '@/lib/api/admin-config'

export async function GET(request: Request) {
  const rateLimitResponse = rateLimitMiddleware(request)
  if (rateLimitResponse) return rateLimitResponse

  const { searchParams } = new URL(request.url)
  const validPeriods = ['24h', '7d', '30d', '90d']
  const period = validPeriods.includes(searchParams.get('period') || '') ? searchParams.get('period') : '30d'

  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const res = await fetch(`${API_URL}/v1/admin/usage?period=${period}`, {
      headers: {
        'Authorization': authorization,
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const error = await res.json()
      return NextResponse.json(error, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Admin usage proxy error:', err)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}
