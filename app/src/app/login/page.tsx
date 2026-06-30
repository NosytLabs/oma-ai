'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { m } from 'framer-motion'
import { useWallet } from '@/components/wallet-provider'
import { Wallet, KeyRound, Shield, Zap } from 'lucide-react'
import { AccountLoginModal } from '@/components/account-login-modal'
import { api } from '@/lib/api'
import { fadeUpProps } from '@/lib/motion'

/**
 * /login — wallet OR account-number authentication entry point.
 *
 * Two tabs, one for each auth method:
 *   - "Wallet" (default): SIWE (Sign-In With Ethereum) on Base mainnet. Connecting
 *     a wallet proves ownership, signs a nonce-bound message, and the server
 *     issues a JWT cookie. This page exists for /protected?next=... redirects
 *     and external links.
 *   - "Account number" (Mullvad-style): no email, no password, no PII. The user
 *     either pastes a previously-saved OMA-XXXX-XXXX-XXXX number or generates a
 *     fresh one. The server creates a "standalone" user row keyed by the
 *     number's SHA-256 hash and issues a JWT.
 *
 * The two flows share a session — the JWT cookie set by either path is honored
 * by the same `sessionAuth` middleware. A user can later prove wallet ownership
 * via SIWE and link that wallet to their account-number-only row.
 *
 * A-C1: We pre-fetch the CSRF token on mount and pass it into the modal so
 * pressing Enter in the account-number field never races the token fetch.
 */
type AuthTab = 'wallet' | 'account'

/**
 * H-LOGIN-1: ensure `next` is a same-origin, single-leading-slash path.
 * Anything else falls back to /dashboard. Defends against open-redirect
 * phishing (e.g. `?next=//evil.com` or `?next=/\evil.com`).
 */
function safeNextPath(raw: string | null | undefined): string {
  const fallback = '/dashboard'
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  return raw
}

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { isReady, isConnected, isAuthenticated, connectEvm } = useWallet()
  // H-LOGIN-1: validate `next` so an attacker can't redirect a freshly-signed-in
  // user off-site. Must be a same-origin single-leading-slash path; reject
  // protocol-relative `//evil.com` and backslash tricks.
  const rawNext = params.get('next') || '/dashboard'
  const next = safeNextPath(rawNext)
  const initialTab = (params.get('method') === 'account' ? 'account' : 'wallet') as AuthTab
  const [tab, setTab] = useState<AuthTab>(initialTab)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  // Bounce to `next` once authenticated.
  useEffect(() => {
    if (isAuthenticated) router.replace(next)
  }, [isAuthenticated, next, router])

  // A-C1: pre-fetch CSRF token on mount so the modal has it synchronously.
  useEffect(() => {
    let cancelled = false
    api.auth.getCsrfToken()
      .then((res) => {
        if (!cancelled && res.token) setCsrfToken(res.token)
      })
      .catch(() => {
        // Silent: modal will fall back to fetching on its own if needed.
      })
    return () => { cancelled = true }
  }, [])

  const handleConnect = async () => {
    try {
      await connectEvm()
    } catch (e) {
      console.error('wallet connect failed', e)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10 sm:py-16">
      <m.div {...fadeUpProps(0)} className="w-full max-w-md">
        <div className="text-center mb-8">
          <m.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent border border-accent/20 mb-4 glow-accent-sm"
          >
            <Shield className="h-6 w-6" aria-hidden="true" />
          </m.div>
          <h1 className="h1-utility text-text-bright">
            Sign in
          </h1>
          <p className="mt-3 text-sm text-text-secondary leading-relaxed">
            OMA doesn&apos;t use email or password. Sign in with a wallet, or with a
            Mullvad-style account number generated on the fly. No PII collected.
          </p>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Authentication method"
          className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1"
        >
          <button
            type="button"
            id="tab-wallet"
            role="tab"
            aria-selected={tab === 'wallet'}
            aria-controls="panel-wallet"
            onClick={() => setTab('wallet')}
            className={
              'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ' +
              (tab === 'wallet'
                ? 'bg-accent text-void shadow-sm'
                : 'text-text-muted hover:text-text')
            }
          >
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            Wallet
          </button>
          <button
            type="button"
            id="tab-account"
            role="tab"
            aria-selected={tab === 'account'}
            aria-controls="panel-account"
            onClick={() => setTab('account')}
            className={
              'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ' +
              (tab === 'account'
                ? 'bg-accent text-void shadow-sm'
                : 'text-text-muted hover:text-text')
            }
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Account number
          </button>
        </div>

        {/* Tab panels */}
        {tab === 'wallet' && (
          <div
            id="panel-wallet"
            role="tabpanel"
            aria-labelledby="tab-wallet"
            className="border border-border bg-surface p-6 space-y-3"
          >
            <button
              type="button"
              onClick={handleConnect}
              disabled={!isReady}
              className="btn-primary w-full inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              {isConnected ? 'Sign in with Ethereum' : 'Connect Wallet'}
            </button>

            <p className="text-[11px] text-text-muted text-center pt-2">
              A SIWE signature proves wallet ownership. No transaction is sent.
            </p>
          </div>
        )}

        {tab === 'account' && (
          <div
            id="panel-account"
            role="tabpanel"
            aria-labelledby="tab-account"
          >
            {/* AccountLoginModal in `inline` mode: same login/create/success flow
                as the global modal, but rendered without the fixed backdrop so it
                fits naturally inside the tab panel. `onClose` is a no-op in
                inline mode — the user switches tabs via the tab buttons above. */}
            <AccountLoginModal onClose={() => {}} inline initialCsrfToken={csrfToken} />
          </div>
        )}

        <p className="mt-6 text-xs text-text-muted text-center">
          New here?{' '}
          <a
            href="/docs"
            className="text-text-secondary hover:text-accent underline underline-offset-2"
          >
            Read the docs
          </a>{' '}
          to see how OMA works.
        </p>

        {/* x402 pay-as-you-go: skip login, pay per request. No account needed. */}
        <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-4">
          <div className="flex items-start gap-3">
            <Zap className="h-4 w-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-bright">
                Skip login — pay per request with x402
              </p>
              <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
                Hit any OMA endpoint directly with an{' '}
                <code className="font-mono text-text-secondary">X-PAYMENT</code>{' '}
                header on Base. No signup, no account, no JWT. Best for AI agents
                and one-off calls.
              </p>
              <a
                href="/docs#x402"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline underline-offset-2"
              >
                How x402 works →
              </a>
            </div>
          </div>
        </div>
      </m.div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[calc(100vh-4rem)]" aria-hidden="true" />}>
      <LoginInner />
    </Suspense>
  )
}
