/**
 * Production error monitoring wrapper.
 *
 * When `NEXT_PUBLIC_SENTRY_DSN` is set and the app runs in production,
 * errors are sent to Sentry with full stack traces, request context, and
 * breadcrumbs.
 *
 * When Sentry is not configured, errors fall back to `serverLog` which
 * forwards them to the backend `/v1/log` endpoint (central pino stream).
 *
 * This module is safe to import in both server and client contexts, but
 * `captureException` in API routes is the primary intended use-case.
 */

import * as Sentry from '@sentry/nextjs'
import { serverLog } from './server-logger'

const SENTRY_ENABLED =
  !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production'

interface CaptureContext {
  /** Human-readable message describing what was happening when the error occurred. */
  msg?: string
  /** Additional structured data to attach to the error event. */
  extra?: Record<string, unknown>
  /** Route or module name for tagging. */
  tag?: string
}

/**
 * Capture an exception in the monitoring service.
 *
 * In production with Sentry enabled, this sends the full error (with stack
 * trace) to Sentry. Otherwise it forwards to the backend log sink via
 * `serverLog.error`.
 */
export function captureException(error: unknown, context?: CaptureContext): void {
  if (SENTRY_ENABLED) {
    Sentry.captureException(error, {
      tags: context?.tag ? { route: context.tag } : undefined,
      extra: context?.extra,
    })
  } else {
    serverLog.error(context?.msg || 'Unhandled exception', error)
  }
}
