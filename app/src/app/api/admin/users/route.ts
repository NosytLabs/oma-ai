import { NextResponse } from 'next/server'
import { getAdminAuthorization, unauthorizedAdminResponse } from '../auth'
import { rateLimitMiddleware } from '../rate-limit'
import { API_URL } from '@/lib/api/admin-config'

export async function GET(request: Request) {
  const rateLimitResponse = rateLimitMiddleware(request)
  if (rateLimitResponse) return rateLimitResponse

  const { searchParams } = new URL(request.url)
  const page = Math.min(parseInt(searchParams.get('page') || '1', 10), 100)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const search = searchParams.get('search')?.slice(0, 200) || ''

  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const res = await fetch(`${API_URL}/v1/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
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
    console.error('Admin users proxy error:', err)
    if (err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('ECONNREFUSED'))) {
      return NextResponse.json({ error: { message: 'Backend unavailable' } }, { status: 503 })
    }
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}
