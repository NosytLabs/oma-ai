import { NextResponse } from 'next/server'
import { readSessionOrReject, proxyPost } from '../_proxy'
import { withRateLimit } from '@/lib/rate-limit-middleware'
import { generalLimiter } from '@/lib/rate-limiter'

export const runtime = 'nodejs'

export const POST = withRateLimit(async (req: Request): Promise<Response> => {
  const session = await readSessionOrReject()
  if (!session) {
    return NextResponse.json(
      { error: { message: 'Not authenticated', type: 'authentication_error' } },
      { status: 401 },
    )
  }
  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  return proxyPost('/v1/deposit/usdc/nonce', body, session)
}, { limiter: generalLimiter, route: '/api/v1/deposit/usdc/nonce' })
