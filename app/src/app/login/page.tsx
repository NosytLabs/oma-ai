'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useWallet } from '@/components/wallet-provider'
import { Wallet, KeyRound, Shield } from 'lucide-react'
import { AccountLoginModal } from '@/components/account-login-modal'

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
 */
type AuthTab = 'wallet' | 'account'

function LoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { isReady, isConnected, isAuthenticated, connectEvm } = useWallet()
  const next = params.get('next') || '/dashboard'
  const initialTab = (params.get('method') === 'account' ? 'account' : 'wallet') as AuthTab
  const [tab, setTab] = useState<AuthTab>(initialTab)

  // Bounce to `next` once authenticated.
  useEffect(() => {
    if (isAuthenticated) router.replace(next)
  }, [isAuthenticated, next, router])

  const handleConnect = async () => {
    try {
      await connectEvm()
    } catch (e) {
      console.error('wallet connect failed', e)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 mb-4">
            <Shield className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-syne text-2xl sm:text-3xl font-bold text-[var(--color-text-bright)] tracking-tight">
            Sign in
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
            OMA doesn&apos;t use email or password. Sign in with a wallet, or with a
            Mullvad-style account number generated on the fly — no PII collected.
          </p>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Authentication method"
          className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'wallet'}
            aria-controls="panel-wallet"
            onClick={() => setTab('wallet')}
            className={
              'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ' +
              (tab === 'wallet'
                ? 'bg-[var(--color-accent)] text-[var(--color-void)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]')
            }
          >
            <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
            Wallet
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'account'}
            aria-controls="panel-account"
            onClick={() => setTab('account')}
            className={
              'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ' +
              (tab === 'account'
                ? 'bg-[var(--color-accent)] text-[var(--color-void)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]')
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
            className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-3"
          >
            <button
              type="button"
              onClick={handleConnect}
              disabled={!isReady}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-[var(--color-void)] transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              {isConnected ? 'Sign in with Ethereum' : 'Connect Wallet'}
            </button>

            <p className="text-[11px] text-[var(--color-text-muted)] text-center pt-2">
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
            <AccountLoginModal onClose={() => {}} inline />
          </div>
        )}

        <p className="mt-6 text-xs text-[var(--color-text-muted)] text-center">
          New here?{' '}
          <a
            href="/docs"
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] underline underline-offset-2"
          >
            Read the docs
          </a>{' '}
          to see how OMA works.
        </p>
      </div>
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
