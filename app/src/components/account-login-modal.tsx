'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Key, Loader2, AlertTriangle, Copy, Check } from 'lucide-react'
import {
  getSessionToken,
  setSessionCookie,
  hasStoredSession,
  setCsrfTokenCookie,
} from '@/lib/cookies'
import { api } from '@/lib/api'

interface AccountLoginModalProps {
  onClose: () => void
  /**
   * Inline mode renders the modal contents without a fixed backdrop or
   * position:fixed wrapper so the host page (e.g. /login tab panel) can
   * embed it. `onClose` becomes a no-op since the user switches context
   * via the host's own controls.
   */
  inline?: boolean
}

type Mode = 'login' | 'create' | 'success'

export function AccountLoginModal({ onClose, inline = false }: AccountLoginModalProps) {
  const [mode, setMode] = useState<Mode>('login')
  const [accountNumber, setAccountNumber] = useState('')
  const [createdAccount, setCreatedAccount] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement
    setHasSession(hasStoredSession())
    
    async function fetchCsrfToken() {
      try {
        const response = await api.auth.getCsrfToken()
        if (response.token) {
          setCsrfTokenCookie(response.token)
          setCsrfToken(response.token)
        }
      } catch (err) {
        console.error('Failed to fetch CSRF token:', err)
      }
    }
    
    fetchCsrfToken()
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]
        
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      triggerRef.current?.focus()
    }
  }, [onClose])

  const handleLogin = useCallback(async () => {
    if (!accountNumber.trim()) return
    setLoading(true)
    setError(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken
      }
      
      const res = await fetch(`${typeof window !== 'undefined' ? '/api' : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/account/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ accountNumber: accountNumber.trim().toUpperCase() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = (body as { error?: { message?: string } })?.error?.message || 'Login failed'
        throw new Error(msg)
      }
      const data = await res.json() as { token: string }
      setSessionCookie(data.token, 7)
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }, [accountNumber, csrfToken])

  const handleCreate = useCallback(async () => {
    const token = getSessionToken()
    if (!token) {
      setError('Please connect your wallet first, then try again.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${typeof window !== 'undefined' ? '/api' : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/account/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = (body as { error?: { message?: string } })?.error?.message || 'Failed to create account'
        throw new Error(msg)
      }
      const data = await res.json() as { accountNumber: string }
      setCreatedAccount(data.accountNumber)
      setMode('success')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account number')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCopy = useCallback(() => {
    if (createdAccount) {
      navigator.clipboard.writeText(createdAccount)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [createdAccount])

  const handleDone = useCallback(() => {
    onClose()
  }, [onClose])

  return (
    <>
      {!inline && (
        <div
          role="presentation"
          className="fixed inset-0 z-[100] bg-[var(--color-overlay)]/60 backdrop-blur-sm cursor-default"
          onClick={onClose}
        />
      )}
      <div
        ref={modalRef}
        className={
          inline
            ? 'w-full border-[var(--color-accent)]/30 bg-[var(--color-panel)] border rounded-xl p-6'
            : 'fixed inset-x-0 top-1/2 -translate-y-1/2 z-[101] mx-4 w-[calc(100%-2rem)] max-w-md border-[var(--color-accent)]/30 bg-[var(--color-panel)] border rounded-xl shadow-2xl'
        }
        onClick={e => e.stopPropagation()}
        role={inline ? undefined : 'dialog'}
        aria-modal={inline ? undefined : 'true'}
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10">
              <Key className="h-5 w-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <h3 id="modal-title" className="text-lg font-bold text-[var(--color-text)]">
                {mode === 'login' ? 'Account Login' : mode === 'create' ? 'Create Account Number' : 'Account Created'}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                {mode === 'login' ? 'Sign in with your account number' : mode === 'create' ? 'Generate a Mullvad-style account number' : 'Save your account number below'}
              </p>
            </div>
          </div>
          {!inline && (
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="rounded-lg p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {error && (
          <div id="account-error" role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-red)]/30 bg-[var(--color-red)]/10 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--color-red)]" />
            <span className="text-sm text-[var(--color-red)]">{error}</span>
          </div>
        )}

        {mode === 'login' && (
          <>
            <div className="mb-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                Account Number
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="OMA-XXXX-XXXX-XXXX"
                aria-label="Account number"
                aria-invalid={!!error}
                aria-describedby={error ? "account-error" : undefined}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 font-mono text-lg tracking-wider placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50 disabled:opacity-50"
                autoFocus
                disabled={loading}
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={loading || !accountNumber.trim()}
              className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
            {hasSession && (
              <p className="mt-4 text-center text-xs text-[var(--color-text-muted)]">
                No account number yet?{' '}
                <button
                  onClick={() => { setMode('create'); setError(null) }}
                  className="text-[var(--color-accent)] hover:text-[var(--color-accent-bright)] cursor-pointer"
                >
                  Create one
                </button>
              </p>
            )}
          </>
        )}

        {mode === 'create' && (
          <>
            <div className="mb-4 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3">
              <p className="text-sm text-[var(--color-text-secondary)]">
                This will generate a unique account number linked to your connected wallet. You can use this number to sign in on any device without a wallet.
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </span>
              ) : (
                'Generate Account Number'
              )}
            </button>
            <p className="mt-4 text-center text-xs text-[var(--color-text-muted)]">
              Already have an account number?{' '}
              <button
                onClick={() => { setMode('login'); setError(null) }}
                className="text-[var(--color-accent)] hover:text-[var(--color-accent-bright)] cursor-pointer"
              >
                Sign in
              </button>
            </p>
          </>
        )}

        {mode === 'success' && createdAccount && (
          <>
            <div className="mb-4 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3">
              <p className="text-sm text-[var(--color-success)] font-medium mb-1">Write this down!</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                This number will only be shown once. If you lose it, you&apos;ll need to create a new account.
              </p>
            </div>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <code className="flex-1 break-all text-lg font-mono text-[var(--color-accent)] tracking-wider">
                {createdAccount}
              </code>
              <button
                onClick={handleCopy}
                aria-label={copied ? 'Copied' : 'Copy to clipboard'}
                className="shrink-0 rounded-lg p-2 transition-colors hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] cursor-pointer"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-[var(--color-success)]" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </div>
            <button
              onClick={handleDone}
              className="btn-primary w-full py-3"
            >
              Done
            </button>
          </>
        )}
      </div>
    </>
  )
}