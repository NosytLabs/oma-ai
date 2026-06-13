import { NextResponse } from 'next/server'

/**
 * Client observability log endpoint.
 *
 * Accepts browser-emitted events (errors, 404s, React boundary catches)
 * and records them for operator inspection. This is intentionally simple
 * and self-contained — no auth, no DB write — so it cannot itself fail
 * in a way that triggers the very logger that's calling it.
 *
 * The route exists because lib/logger.ts unconditionally POSTs to
 * `/api/admin/observability/log`. Before this file existed, every
 * client error in production was silently lost as a 404 in the terminal.
 */

interface LogPayload {
  level?: 'error' | 'warn' | 'info'
  event?: string
  ctx?: Record<string, unknown>
  ts?: number
  url?: string
  userAgent?: string
}

// Ring buffer of recent events for ad-hoc retrieval via GET.
// Capped so a runaway client cannot OOM the Node process.
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

export async function GET() {
  return NextResponse.json({
    count: recentEvents.length,
    events: recentEvents.slice(-50),
  })
}
