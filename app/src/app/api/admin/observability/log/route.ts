import { NextResponse } from 'next/server'

import { getAdminAuthorization, unauthorizedAdminResponse } from '../../auth'

/**
 * Client observability log endpoint.
 *
 * Accepts browser-emitted events (errors, 404s, React boundary catches)
 * and records them for operator inspection. This is intentionally simple
 * and self-contained — no DB write — so it cannot itself fail
 * in a way that triggers the very logger that's calling it.
 *
 * The POST route is intended to be called from top-level error
 * boundaries (or a custom `window.onerror` handler) — not from every
 * `console.*` call site. A 1:1 fan-out would amplify a single broken
 * network into a log-storm. The shared `lib/logger.ts` wrapper does
 * NOT post here automatically; callers wire that up explicitly when
 * they need operator visibility.
 *
 * The GET route requires admin auth and returns the recent ring buffer
 * for operator inspection.
 */

interface LogPayload {
  level?: 'error' | 'warn' | 'info'
  event?: string
  ctx?: Record<string, unknown>
  ts?: number
  url?: string
  userAgent?: string
}

const RING_CAPACITY = 500
const recentEvents: Array<LogPayload & { receivedAt: number }> = []

export async function POST(request: Request) {
  let payload: LogPayload = {}
  try {
    payload = (await request.json()) as LogPayload
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  const event = {
    ...payload,
    level: payload.level ?? 'info',
    event: (payload.event ?? 'unknown').slice(0, 200),
    ctx: payload.ctx ?? {},
    receivedAt: Date.now(),
  }
  recentEvents.push(event)
  if (recentEvents.length > RING_CAPACITY) {
    recentEvents.splice(0, recentEvents.length - RING_CAPACITY)
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[observability]', event.level, event.event, event.ctx)
  }

  return new NextResponse(null, { status: 204 })
}

export async function GET(request: Request) {
  const authorization = getAdminAuthorization(request)
  if (!authorization) return unauthorizedAdminResponse()

  return NextResponse.json({
    count: recentEvents.length,
    events: recentEvents.slice(-50),
  })
}
