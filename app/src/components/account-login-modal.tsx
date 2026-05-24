'use client'

import { useState, useCallback, useEffect } from 'react'
import { X, Key, Loader2, AlertTriangle, Copy, Check } from 'lucide-react'

interface AccountLoginModalProps {
  onClose: () => void
}

type Mode = 'login' | 'create' | 'success'

export function AccountLoginModal({ onClose }: AccountLoginModalProps) {
  const [mode, setMode] = useState<Mode>('login')
  const [accountNumber, setAccountNumber] = useState('')
  const [createdAccount, setCreatedAccount] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('oma_session')
    setHasSession(!!token)
  }, [])

  const handleLogin = useCallback(async () => {
    if (!accountNumber.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${typeof window !== 'undefined' ? '/api' : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/auth/account/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber: accountNumber.trim().toUpperCase() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = (body as { error?: { message?: string } })?.error?.message || 'Login failed'
        throw new Error(msg)
      }
      const data = await res.json() as { token: string }
      localStorage.setItem('oma_session', data.token)
      const expires = new Date(Date.now() + 7 * 86400000).toUTCString()
      document.cookie = `oma_session=${data.token}; expires=${expires}; path=/; SameSite=Lax`
      window.location.reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }, [accountNumber])

  const handleCreate = useCallback(async () => {
    const token = localStorage.getItem('oma_session')
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card mx-4 w-full max-w-md border-indigo-500/30" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10">
              <Key className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {mode === 'login' ? 'Account Login' : mode === 'create' ? 'Create Account Number' : 'Account Created'}
              </h3>
              <p className="text-xs text-text-secondary">
                {mode === 'login' ? 'Sign in with your account number' : mode === 'create' ? 'Generate a Mullvad-style account number' : 'Save your account number below'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-2 text-text-secondary hover:bg-surface hover:text-text transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div id="account-error" role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {mode === 'login' && (
          <>
            <div className="mb-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-text-secondary">
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
                aria-describedby="account-error"
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 font-mono text-lg tracking-wider placeholder:text-text-dim focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
                disabled={loading}
              />
            </div>
            <button
              onClick={handleLogin}
              disabled={loading || !accountNumber.trim()}
              className="btn-primary w-full py-3 disabled:opacity-50"
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
              <p className="mt-4 text-center text-xs text-text-secondary">
                No account number yet?{' '}
                <button
                  onClick={() => { setMode('create'); setError(null) }}
                  className="text-indigo-500 hover:text-indigo-400"
                >
                  Create one
                </button>
              </p>
            )}
          </>
        )}

        {mode === 'create' && (
          <>
            <div className="mb-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
              <p className="text-sm text-text-secondary">
                This will generate a unique account number linked to your connected wallet. You can use this number to sign in on any device without a wallet.
              </p>
            </div>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="btn-primary w-full py-3 disabled:opacity-50"
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
            <p className="mt-4 text-center text-xs text-text-secondary">
              Already have an account number?{' '}
              <button
                onClick={() => { setMode('login'); setError(null) }}
                className="text-indigo-500 hover:text-indigo-400"
              >
                Sign in
              </button>
            </p>
          </>
        )}

        {mode === 'success' && createdAccount && (
          <>
            <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
              <p className="text-sm text-green-400 font-medium mb-1">Write this down!</p>
              <p className="text-xs text-text-secondary">
                This number will only be shown once. If you lose it, you&apos;ll need to create a new account.
              </p>
            </div>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface p-4">
              <code className="flex-1 break-all text-lg font-mono text-indigo-400 tracking-wider">
                {createdAccount}
              </code>
              <button
                onClick={handleCopy}
                aria-label={copied ? 'Copied' : 'Copy to clipboard'}
                className="shrink-0 rounded-lg p-2 transition-colors hover:bg-indigo-500/10 hover:text-indigo-500"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-green-400" />
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
    </div>
  )
}