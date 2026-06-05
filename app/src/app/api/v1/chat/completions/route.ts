import { NextResponse } from 'next/server'
import { API_URL } from '@/lib/api/admin-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const PROXY_ENABLED = process.env.CHAT_PROXY_ENABLED === 'true'

const PASSTHROUGH_REQUEST_HEADERS = [
  'authorization',
  'idempotency-key',
  'x-correlation-id',
  'content-type',
  'accept',
  'accept-encoding',
  'user-agent',
] as const

const PASSTHROUGH_RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'x-provider',
  'x-correlation-id',
  'x-request-id',
  'pay-req',
] as const

function buildDisabledResponse() {
  return NextResponse.json(
    {
      error: {
        message:
          'Chat completions proxy is disabled. Call the backend directly at NEXT_PUBLIC_API_URL/v1/chat/completions, or set CHAT_PROXY_ENABLED=true in the deployment environment.',
        type: 'proxy_disabled',
        code: 'chat_proxy_disabled',
      },
    },
    {
      status: 503,
      headers: { 'Retry-After': '3600' },
    },
  )
}

function buildServerErrorResponse(err: unknown) {
  console.error('[chat-proxy] /v1/chat/completions error:', err)
  return NextResponse.json(
    {
      error: {
        message: 'Chat proxy failed to reach the upstream API',
        type: 'proxy_error',
        code: 'upstream_unreachable',
      },
    },
    { status: 502 },
  )
}

export async function POST(request: Request) {
  if (!PROXY_ENABLED) {
    return buildDisabledResponse()
  }

  const requestHeaders = new Headers()
  for (const name of PASSTHROUGH_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) requestHeaders.set(name, value)
  }

  let body: BodyInit
  try {
    body = await request.arrayBuffer()
  } catch {
    return NextResponse.json(
      {
        error: {
          message: 'Invalid or unreadable request body',
          type: 'invalid_request_error',
          code: 'bad_request_body',
        },
      },
      { status: 400 },
    )
  }

  const accept = request.headers.get('accept') || ''
  const wantsStream = accept.includes('text/event-stream')

  let upstream: Response
  try {
    upstream = await fetch(`${API_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: requestHeaders,
      body,
      cache: 'no-store',
    })
  } catch (err) {
    return buildServerErrorResponse(err)
  }

  const responseHeaders = new Headers()
  for (const name of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }

  if (wantsStream && upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  }

  const isJson =
    (upstream.headers.get('content-type') || '').toLowerCase().includes('application/json')

  if (isJson) {
    let payload: unknown
    try {
      payload = await upstream.json()
    } catch {
      payload = { error: { message: 'Upstream returned invalid JSON', type: 'proxy_error' } }
    }
    return NextResponse.json(payload, {
      status: upstream.status,
      headers: responseHeaders,
    })
  }

  const text = await upstream.text()
  return new Response(text, { status: upstream.status, headers: responseHeaders })
}

export function GET() {
  return NextResponse.json(
    {
      error: {
        message: 'POST required. This proxy only accepts POST /api/v1/chat/completions.',
        type: 'invalid_request_error',
        code: 'method_not_allowed',
      },
    },
    { status: 405, headers: { Allow: 'POST' } },
  )
}
