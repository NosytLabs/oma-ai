import { NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limit-middleware'
import { generalLimiter } from '@/lib/rate-limiter'

export const runtime = 'nodejs'

/**
 * Frontend liveness check.
 *
 * This route indicates that the Next.js app itself is alive and serving
 * traffic — NOT whether the downstream inference backend (port 3001) is
 * reachable. Backend reachability is surfaced at the actual API call sites
 * (chat completions, models, etc.) where the user has a real reason to care.
 *
 * Returning a non-200 from this endpoint paints the navbar "Reconnecting…"
 * warning indicator on every public page, which is a poor UX for marketing
 * surfaces (/, /pricing, /docs) that don't need the backend.
 *
 * Always 200. No auth. No upstream call. Cheap & cacheable.
 */
export const GET = withRateLimit(async () => {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'oma-ai-web',
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    }
  )
}, { limiter: generalLimiter, route: '/api/health' })
