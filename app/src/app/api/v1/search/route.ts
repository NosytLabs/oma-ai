import { NextResponse } from 'next/server'
import { API_URL } from '@/lib/api/admin-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PASSTHROUGH_REQUEST_HEADERS = [
  'authorization',
  'accept',
  'user-agent',
] as const

const PASSTHROUGH_RESPONSE_HEADERS = [
  'content-type',
] as const

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')
  if (!query) {
    return NextResponse.json(
      { error: { message: 'Missing query parameter', type: 'invalid_request_error' } },
      { status: 400 },
    )
  }

  const requestHeaders = new Headers()
  for (const name of PASSTHROUGH_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) requestHeaders.set(name, value)
  }

  let upstream: Response
  try {
    upstream = await fetch(`${API_URL}/v1/search?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: requestHeaders,
      cache: 'no-store',
    })
  } catch (err) {
    console.error('[search-proxy] /v1/search error:', err)
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
}
