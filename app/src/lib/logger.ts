/**
 * Lightweight client-side error/event logger.
 *
 * In production: sends events to the server's observability endpoint so
 * the operator can see client errors, 404s, and React boundary catches in
 * the admin analytics dashboard. If the request fails (e.g. offline), the
 * event is dropped silently — never throw from a logger.
 *
 * In development: just `console.error` so the dev sees it inline.
 *
 * The server endpoint is mounted at /api/admin/observability/log and is
 * auth-gated; client events that arrive without auth are recorded as
 * anonymous (no user id) so they can still be observed.
 */

type LogLevel = 'error' | 'warn' | 'info'

interface LogContext {
  [key: string]: unknown
}

interface LogPayload {
  level: LogLevel
  event: string
  ctx: LogContext
  ts: number
  // Browser-only context; undefined during SSR
  url?: string
  userAgent?: string
}

function emit(level: LogLevel, event: string, ctx: LogContext): void {
  if (typeof window === 'undefined') {
    // SSR — nothing to log.
    return
  }
  const payload: LogPayload = {
    level,
    event,
    ctx,
    ts: Date.now(),
    url: window.location.pathname + window.location.search,
    userAgent: navigator.userAgent,
  }
  if (process.env.NODE_ENV !== 'production') {
    // Dev: print to console for visibility.
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.info)(
      `[${event}]`,
      ctx,
    )
    return
  }
  // Prod: best-effort POST. Use sendBeacon if available (survives unload);
  // fall back to fetch with keepalive.
  try {
    const body = JSON.stringify(payload)
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon('/api/admin/observability/log', blob)
    } else {
      void fetch('/api/admin/observability/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // never throw from a logger
  }
}

export const log = {
  error: (event: string, ctx: LogContext = {}) => emit('error', event, ctx),
  warn: (event: string, ctx: LogContext = {}) => emit('warn', event, ctx),
  info: (event: string, ctx: LogContext = {}) => emit('info', event, ctx),
}
