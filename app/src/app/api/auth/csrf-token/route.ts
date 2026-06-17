import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/auth/csrf-token — proxies to backend /auth/csrf-token.
 * The CSRF cookie is set by the backend in the Set-Cookie response;
 * we forward it to the browser under our own origin so subsequent
 * same-origin requests (like the account login POST) include it.
 */
export async function GET(_req: NextRequest) {
  const backend = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  try {
    const res = await fetch(`${backend}/auth/csrf-token`, {
      method: 'GET',
      credentials: 'include',
    })
    const body = await res.text()
    const out = new NextResponse(body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    })
    // Forward Set-Cookie so the browser stores csrf_token on our origin.
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) out.headers.set('set-cookie', setCookie)
    return out
  } catch (_e) {
    return NextResponse.json({ error: { message: 'Backend unreachable' } }, { status: 502 })
  }
}
