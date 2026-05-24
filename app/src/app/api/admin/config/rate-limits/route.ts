import { NextResponse } from 'next/server'

import { getAdminAuthorization, unauthorizedAdminResponse } from '../../auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function GET(request: Request) {
  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const res = await fetch(`${API_URL}/v1/admin/config/rate-limits`, {
      headers: { Authorization: authorization },
      cache: 'no-store',
    })

    if (!res.ok) {
      const error = await res.json()
      return NextResponse.json(error, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Get rate limits config error:', err)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const body = await request.json()
    const res = await fetch(`${API_URL}/v1/admin/config/rate-limits`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const error = await res.json()
      return NextResponse.json(error, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Update rate limits config error:', err)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}
