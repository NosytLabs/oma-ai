import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const PROTECTED_PATHS = ['/dashboard', '/admin', '/settings', '/deposit', '/playground']
const SESSION_COOKIE_NAME = 'oma_session'

const ISSUER = 'oma-ai'
const AUDIENCE = 'oma-ai-api'

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    return null
  }
  return new TextEncoder().encode(secret)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path))
  if (!isProtected) return NextResponse.next()

  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!session) {
    // Preserve the intended destination so the client can navigate back after sign-in.
    const redirectUrl = new URL('/', request.url)
    redirectUrl.searchParams.set('next', pathname)
    redirectUrl.searchParams.set('auth', 'required')
    return NextResponse.redirect(redirectUrl)
  }

  const secret = getSecret()
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('middleware: JWT_SECRET missing or too short; redirecting protected requests to /')
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    await jwtVerify(session, secret, { issuer: ISSUER, audience: AUDIENCE })
    return NextResponse.next()
  } catch {
    const redirectUrl = new URL('/', request.url)
    redirectUrl.searchParams.set('next', pathname)
    redirectUrl.searchParams.set('auth', 'expired')
    return NextResponse.redirect(redirectUrl)
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/settings/:path*', '/deposit/:path*', '/playground/:path*'],
}
