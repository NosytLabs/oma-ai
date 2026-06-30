import { NextResponse } from 'next/server'
import { readSessionOrReject, proxyGet } from '../../usdc/_proxy'
import { withRateLimit } from '@/lib/rate-limit-middleware'
import { generalLimiter } from '@/lib/rate-limiter'

export const runtime = 'nodejs'

export const GET = withRateLimit(async (): Promise<Response> => {
  const session = await readSessionOrReject()
  if (!session) {
    return NextResponse.json(
      { error: { message: 'Not authenticated', type: 'authentication_error' } },
      { status: 401 },
    )
  }
  return proxyGet('/v1/deposit/houdini/tokens', session)
}, { limiter: generalLimiter, route: '/api/v1/deposit/houdini/tokens' })
