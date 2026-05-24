import { NextResponse } from 'next/server'

export function getAdminAuthorization(request: Request) {
  const authorization = request.headers.get('Authorization')
  if (authorization) {
    return authorization
  }

  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) {
    return null
  }

  const sessionCookie = cookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith('oma_session='))

  if (!sessionCookie) {
    return null
  }

  const sessionToken = sessionCookie.slice('oma_session='.length)
  return sessionToken ? `Bearer ${sessionToken}` : null
}

export function unauthorizedAdminResponse() {
  return NextResponse.json({ error: { message: 'Authentication required' } }, { status: 401 })
}
