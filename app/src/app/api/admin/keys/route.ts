import { NextResponse } from 'next/server'

import { getAdminAuthorization, unauthorizedAdminResponse } from '../auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') || '1'
  const limit = searchParams.get('limit') || '100'

  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const res = await fetch(`${API_URL}/admin/keys?page=${page}&limit=${limit}`, {
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
