import { NextResponse } from 'next/server'

import { getAdminAuthorization, unauthorizedAdminResponse } from '../../auth'
import { rateLimitMiddleware } from '../../rate-limit'
import { API_URL } from '@/lib/api/admin-config'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimitMiddleware(request)
  if (rateLimitResponse) return rateLimitResponse

  const { id } = await params

  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const res = await fetch(`${API_URL}/v1/admin/users/${id}`, {
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
    console.error('Admin user detail proxy error:', err)
    if (err instanceof TypeError || (err as { code?: string })?.code === 'ECONNREFUSED' || (err as { cause?: { code?: string } })?.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json({ error: { message: 'Backend unavailable' } }, { status: 503 })
    }
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}
