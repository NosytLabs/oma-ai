import { type NextRequest, NextResponse } from 'next/server'
import { DEFAULT_API_URL } from '@/lib/config'
import { withRateLimit } from '@/lib/rate-limit-middleware'
import { authLimiter } from '@/lib/rate-limiter'

export const runtime = 'nodejs'

/**
 * /api/auth/logout — terminates the current SIWE / account-number session.
 *
 * Forwards the call to the backend `/auth/logout` (which clears the JWT
 * server-side) and then explicitly clears the `oma_session` and
 * `oma_session_meta` cookies on this origin. The wallet-provider runs
 * `disconnect()` on the client to drop wagmi state, but without this
 * route the server-side JWT cookie survives a "log out" click.
 *
 * The cookie is not HttpOnly (it's set via `document.cookie` after a
 * successful login), so this route must be the single source of truth
 * for expiry. See app/src/lib/cookies.ts for the cookie semantics.
 */
export const POST = withRateLimit(async (_req: NextRequest) => {
  const backend = DEFAULT_API_URL
  const cookieHeader = _req.headers.get('cookie') || ''

  // Best-effort server-side logout. We don't fail the request if the
  // backend is unreachable — the client should still be able to clear
  // its local cookies and disconnect the wallet.
  try {
    await fetch(`${backend}/auth/logout`, {
      method: 'POST',
      headers: { cookie: cookieHeader },
      // Short timeout so a hung backend doesn't block the UI.
      signal: AbortSignal.timeout(2_000),
    })
  } catch {
    // Swallow — see comment above.
  }

  const res = NextResponse.json({ success: true })
  const expires = 'Thu, 01 Jan 1970 00:00:00 GMT'
  const isProd = process.env.NODE_ENV === 'production'
  res.headers.append(
    'Set-Cookie',
    `oma_session=; expires=${expires}; path=/; SameSite=Strict${isProd ? '; Secure' : ''}`,
  )
  res.headers.append(
    'Set-Cookie',
    `oma_session_meta=; expires=${expires}; path=/; SameSite=Strict${isProd ? '; Secure' : ''}`,
  )
  res.headers.set('cache-control', 'no-store')
  return res
}, { limiter: authLimiter, route: '/api/auth/logout' })
