import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { DEFAULT_API_URL as API_URL } from '@/lib/config'
import { withRateLimit } from '@/lib/rate-limit-middleware'
import { generationLimiter } from '@/lib/rate-limiter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 1 * 1024 * 1024 // 1 MB

const PASSTHROUGH_REQUEST_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'user-agent',
] as const

const PASSTHROUGH_RESPONSE_HEADERS = [
  'content-type',
  'x-request-id',
] as const

export const POST = withRateLimit(async (request: NextRequest) => {
  // --- Auth gate (runs on the server, cookies are HttpOnly) ---
  const authHeader = request.headers.get('authorization')
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('oma_session')?.value
  if (!authHeader && !sessionCookie) {
    return NextResponse.json(
      { error: { message: 'Unauthorized', type: 'auth_required' } },
      { status: 401 },
    )
  }

  // --- Body size guard ---
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: { message: 'Payload too large (max 1 MB)', type: 'payload_too_large' } },
      { status: 413 },
    )
  }

  const requestHeaders = new Headers()
  for (const name of PASSTHROUGH_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) requestHeaders.set(name, value)
  }

  // Read body but enforce size while streaming into memory
  let body: BodyInit
  try {
    const buf = await request.arrayBuffer()
    if (buf.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: { message: 'Payload too large (max 1 MB)', type: 'payload_too_large' } },
        { status: 413 },
      )
    }
    body = buf
  } catch {
    return NextResponse.json(
      { error: { message: 'Invalid request body', type: 'invalid_request_error' } },
      { status: 400 },
    )
  }

  let upstream: Response
  try {
    upstream = await fetch(`${API_URL}/v1/videos/generations`, {
      method: 'POST',
      headers: requestHeaders,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    })
  } catch (err) {
    console.error('[video-proxy] /v1/videos/generations error:', err)
    return NextResponse.json(
      { error: { message: 'Failed to reach upstream API', type: 'proxy_error' } },
      { status: 502 },
    )
  }

  const responseHeaders = new Headers()
  for (const name of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }

  let payload: unknown
  try {
    payload = await upstream.json()
  } catch {
    payload = { error: { message: 'Upstream returned invalid JSON', type: 'proxy_error' } }
  }
  return NextResponse.json(payload, { status: upstream.status, headers: responseHeaders })
}, { limiter: generationLimiter, route: '/api/v1/videos/generations' })
