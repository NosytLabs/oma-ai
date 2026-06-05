import { NextResponse } from 'next/server'
import { getAdminAuthorization, unauthorizedAdminResponse } from '../auth'
import { rateLimitMiddleware } from '../rate-limit'
import { API_URL } from '@/lib/api/admin-config'

export async function GET(request: Request) {
  const rateLimitResponse = rateLimitMiddleware(request)
  if (rateLimitResponse) return rateLimitResponse

  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') || '1'
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)

  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const res = await fetch(`${API_URL}/v1/admin/keys?page=${page}&limit=${limit}`, {
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
    console.error('Admin keys proxy error:', err)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}
