import { NextResponse } from 'next/server'

import { getAdminAuthorization, unauthorizedAdminResponse } from '../auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function GET(request: Request) {
  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const res = await fetch(`${API_URL}/v1/admin/rate-limit-overrides`, {
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
    console.error('Get rate limit overrides error:', err)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const body = await request.json()
    const res = await fetch(`${API_URL}/v1/admin/rate-limit-overrides`, {
      method: 'POST',
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
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Create rate limit override error:', err)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: { message: 'Override ID required' } }, { status: 400 })
  }

  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const res = await fetch(`${API_URL}/v1/admin/rate-limit-overrides/${id}`, {
      method: 'DELETE',
      headers: { Authorization: authorization },
    })

    if (!res.ok) {
      const error = await res.json()
      return NextResponse.json(error, { status: res.status })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete rate limit override error:', err)
    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 })
  }
}
