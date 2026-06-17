import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/auth/account/create — proxies to backend /auth/account/create.
 * Same shape as /api/auth/account/login.
 */
export async function POST(req: NextRequest) {
  const backend = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const cookieHeader = req.headers.get('cookie') || ''
  const csrf = req.headers.get('x-csrf-token') || ''
  const auth = req.headers.get('authorization') || ''
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'cookie': cookieHeader,
    }
    if (csrf) headers['x-csrf-token'] = csrf
    if (auth) headers['authorization'] = auth
    const res = await fetch(`${backend}/auth/account/create`, {
      method: 'POST',
      headers,
      body: req.body,
      // @ts-expect-error duplex is needed for streamed body in Node fetch
      duplex: 'half',
    })
    const body = await res.text()
    const out = new NextResponse(body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) out.headers.set('set-cookie', setCookie)
    return out
  } catch (_e) {
    return NextResponse.json({ error: { message: 'Backend unreachable' } }, { status: 502 })
  }
}
