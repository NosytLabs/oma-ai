import { NextResponse } from 'next/server'

import { getAdminAuthorization, unauthorizedAdminResponse } from '../auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '30d'

  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const res = await fetch(`${API_URL}/admin/revenue?period=${period}`, {
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
    console.error('Admin revenue proxy error:', err)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}
