/**
 * Server-side structured logger for Next.js API routes and server components.
 *
 * Unlike the client-safe `log` in `./logger.ts`, this module:
 *   - Is **never** imported in browser code (only server / API routes).
 *   - In development: prints structured lines to stderr/stdout via console.*.
 *   - In production: forwards every log entry to the backend `/v1/log`
 *     endpoint as JSON so logs survive `compiler.removeConsole` and are
 *     persisted in the central pino stream.
 *
 * Fire-and-forget forwarding:
 *   - `fetch()` is fire-and-forget (not awaited) so logging never blocks
 *     the request hot path.
 *   - Network failures are silently dropped to avoid cascading errors.
 */

import { DEFAULT_API_URL } from './config'

if (typeof window !== 'undefined') {
  throw new Error(
    'server-logger.ts must never be imported in browser code. ' +
    'Use @/lib/logger (client-safe) or @/lib/monitor instead.'
  )
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export type LogCtx = Record<string, unknown> | Error | unknown

interface LogEntry {
  level: LogLevel
  msg: string
  ctx?: unknown
  timestamp: string
  service: 'oma-app'
  env: string
}

function format(prefix: string, msg: string, ctx?: LogCtx): unknown[] {
  if (ctx === undefined) return [`${prefix} ${msg}`]
  return [`${prefix} ${msg}`, ctx]
}

function buildEntry(level: LogLevel, msg: string, ctx?: LogCtx): LogEntry {
  return {
    level,
    msg,
    ctx: ctx instanceof Error ? { message: ctx.message, stack: ctx.stack, name: ctx.name } : ctx,
    timestamp: new Date().toISOString(),
    service: 'oma-app',
    env: process.env.NODE_ENV || 'development',
  }
}

/** Fire-and-forget POST to the backend log sink.  */
function forward(entry: LogEntry): void {
  const url = `${DEFAULT_API_URL}/v1/log`
  let body: string
  try {
    body = JSON.stringify(entry)
  } catch {
    body = JSON.stringify({
      level: entry.level,
      msg: entry.msg,
      ctx: { serializationFailed: true, ctxType: typeof entry.ctx },
      timestamp: entry.timestamp,
      service: entry.service,
      env: entry.env,
    })
  }
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Name': 'oma-app',
    },
    body,
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    /* silently drop forwarding failures to avoid cascading errors */
  })
}

function shouldForward(): boolean {
  return process.env.NODE_ENV === 'production'
}

export const serverLog = {
  error(msg: string, ctx?: LogCtx): void {
    if (shouldForward()) {
      forward(buildEntry('error', msg, ctx))
    } else {
      console.error(...format('[server]', msg, ctx))
    }
  },

  warn(msg: string, ctx?: LogCtx): void {
    if (shouldForward()) {
      forward(buildEntry('warn', msg, ctx))
    } else {
      console.warn(...format('[server]', msg, ctx))
    }
  },

  info(msg: string, ctx?: LogCtx): void {
    if (shouldForward()) {
      forward(buildEntry('info', msg, ctx))
    } else {
      console.info(...format('[server]', msg, ctx))
    }
  },

  debug(msg: string, ctx?: LogCtx): void {
    if (shouldForward()) {
      forward(buildEntry('debug', msg, ctx))
    } else {
      console.debug(...format('[server]', msg, ctx))
    }
  },
}
