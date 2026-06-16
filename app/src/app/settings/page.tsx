'use client'

import { useWallet } from '@/components/wallet-provider'
import { api, type User, type ApiKey, type Session } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import dynamic from 'next/dynamic'
import {
  Wallet,
  Hexagon,
  Link2,
  Unlink,
  Shield,
  AlertTriangle,
  Loader2,
  LogOut,
  Clock,
  Trash2,
  X,
  Copy,
  Check,
  Fingerprint,
  Calendar,
  User as UserIcon,
  ShieldOff,
  Key,
  KeyRound,
  Sparkles,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { m, AnimatePresence } from 'framer-motion'

// B-C1 fix: also offer account-number login (and demo) on /settings, not
// just EVM. The unauthenticated card now previews the 5 actual settings
// sections the user will see once signed in.
const AccountLoginModal = dynamic(
  () => import('@/components/account-login-modal').then(m => m.AccountLoginModal),
  { ssr: false }
)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SettingsPage() {
  const { isAuthenticated, connectEvm, evmAddress, disconnect } = useWallet()
  const toast = useToast()

  const [user, setUser] = useState<User | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [unlinkingEvm, setUnlinkingEvm] = useState(false)
  const [generatingAccount, setGeneratingAccount] = useState(false)
  // B-C1: pre-fetch CSRF + track which auth method the user picked
  // from the unauthenticated card. Avoids the A-C1 race in the modal.
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [showAccountLogin, setShowAccountLogin] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.auth.getCsrfToken()
      .then((res) => { if (!cancelled && res.token) setCsrfToken(res.token) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [userData, keysData, sessionsData] = await Promise.all([
          api.auth.getUser(),
          api.auth.listKeys(),
          api.auth.listSessions(),
        ])
        if (!cancelled) {
          setUser(userData)
          setApiKeys(keysData)
          setSessions(sessionsData)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load settings')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [isAuthenticated])

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }, [toast])

  const handleUnlinkEvm = async () => {
    setUnlinkingEvm(true)
    try {
      await api.auth.unlinkWallet('evm')
      disconnect()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to unlink EVM wallet')
    } finally {
      setUnlinkingEvm(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await api.auth.logout()
      disconnect()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Logout failed')
    } finally {
      setLoggingOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await api.auth.deleteAccount()
      setShowDeleteConfirm(false)
      disconnect()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Account deletion failed')
    } finally {
      setDeleting(false)
    }
  }

  const handleGenerateAccountNumber = async () => {
    setGeneratingAccount(true)
    try {
      const result = await api.auth.createAccountNumber()
      setUser((prev) => prev ? { ...prev, accountNumber: result.accountNumber } : null)
      toast.success('Account number generated')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate account number')
    } finally {
      setGeneratingAccount(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl"
        >
          <m.div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/5"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            <UserIcon className="h-7 w-7 text-accent" />
          </m.div>
          <h2 className="mb-2 text-center text-xl font-bold tracking-tight font-display">Sign in to manage your account</h2>
          <p className="mb-6 text-center text-sm text-text-secondary">
            Settings covers your wallets, account number, sessions, and API keys.
          </p>

          {/* B-C1 fix: preview the actual sections the user will see. */}
          <ul className="mb-6 grid grid-cols-1 gap-2 text-left sm:grid-cols-2">
            {[
              { icon: Wallet, label: 'Connected Wallets' },
              { icon: Fingerprint, label: 'Account Number' },
              { icon: Key, label: 'API Keys' },
              { icon: Clock, label: 'Active Sessions' },
            ].map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 border border-border bg-surface/50 px-3 py-2 text-xs text-text-secondary"
              >
                <Icon className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <m.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => connectEvm()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-text-inverse shadow-lg shadow-accent/20 transition-all hover:bg-accent/90 sm:w-auto"
            >
              <Hexagon className="h-4 w-4" />
              Connect Wallet
            </m.button>
            <m.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAccountLogin(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text transition-colors hover:border-accent/60 hover:text-text-bright sm:w-auto"
            >
              <KeyRound className="h-4 w-4" />
              Account Number
            </m.button>
          </div>
          <div className="mt-3 text-center">
            <a
              href="/dashboard?demo=1"
              className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Try the dashboard in demo mode
            </a>
          </div>
        </m.div>

        {showAccountLogin && (
          <AccountLoginModal
            onClose={() => setShowAccountLogin(false)}
            initialCsrfToken={csrfToken}
          />
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <m.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="h1-utility">Settings</h1>
        <p className="mt-1 text-xs text-text-secondary">
          Account {loading ? 'Syncing...' : error ? 'Degraded' : 'Nominal'}
        </p>
      </m.div>

      <AnimatePresence>
        {error && (
          <m.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 flex items-center gap-3 rounded-xl border border-error/30 bg-error/5 px-4 py-3"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-error" />
            <span className="text-sm text-text">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-text-secondary hover:text-text">
              <X className="h-3.5 w-3.5" />
            </button>
          </m.div>
        )}
      </AnimatePresence>

      <m.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6 border border-border p-6"
      >
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          <Wallet className="h-3.5 w-3.5" />
          Connected Wallets
        </div>

        <div className="space-y-3">
          <m.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-3 border border-border p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue/30 bg-blue/10">
              <Hexagon className="h-5 w-5 text-blue" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-text">EVM Wallet</span>
                  <span className="rounded-full bg-blue/20 px-2 py-0.5 text-[10px] font-bold text-blue">Base</span>
                </div>
                {evmAddress ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-accent" title={evmAddress}>
                      {evmAddress.slice(0, 6)}...{evmAddress.slice(-4)}
                    </span>
                    <m.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCopy(evmAddress, 'evm')}
                      className="shrink-0 rounded-lg p-2.5 transition-colors hover:bg-surface"
                    >
                      {copied === 'evm' ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-text-muted" />
                      )}
                    </m.button>
                  </div>
                ) : (
                  <span className="text-xs text-text-muted">Not connected</span>
                )}
              </div>
            {evmAddress ? (
              <m.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUnlinkEvm}
                disabled={unlinkingEvm}
                className="inline-flex items-center gap-1.5 border border-amber/30 px-3 py-1.5 text-[10px] font-semibold text-amber transition-all hover:bg-amber/5 disabled:opacity-40"
              >
                {unlinkingEvm ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Unlink className="h-3 w-3" />
                )}
                Unlink
              </m.button>
            ) : (
              <m.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => connectEvm()}
                className="inline-flex items-center gap-1.5 border border-accent bg-void px-3 py-1.5 text-[10px] font-semibold text-accent"
              >
                <Link2 className="h-3 w-3" />
                Connect
              </m.button>
            )}
          </m.div>
        </div>
      </m.div>

      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-6 border border-border p-6"
      >
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          <Fingerprint className="h-3.5 w-3.5" />
          Account Number
        </div>

        <div className="flex items-center gap-3 border border-border px-4 py-4">
          {user?.accountNumber ? (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-mono font-bold tracking-wider text-accent">
                  {user.accountNumber}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
                  <Shield className="h-3 w-3" />
                  <span>Mullvad-style account number for wallet-free login</span>
                </div>
              </div>
              <m.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCopy(user.accountNumber!, 'accountNumber')}
                className="rounded-lg p-2.5 transition-colors hover:bg-surface"
              >
                {copied === 'accountNumber' ? (
                  <Check className="h-5 w-5 text-success" />
                ) : (
                  <Copy className="h-5 w-5 text-text-muted" />
                )}
              </m.button>
            </>
          ) : (
            <>
              <div className="flex-1">
                <div className="text-sm text-text-muted">
                  No account number generated yet
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-text-muted">
                  <Shield className="h-3 w-3" />
                  <span>Generate to enable wallet-free login with your account number</span>
                </div>
              </div>
              <m.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGenerateAccountNumber}
                disabled={generatingAccount}
                className="inline-flex items-center gap-1.5 border border-accent bg-void px-4 py-2 text-xs font-semibold text-accent transition-all hover:bg-accent/10 disabled:opacity-40"
              >
                {generatingAccount ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Key className="h-3 w-3" />
                )}
                Generate
              </m.button>
            </>
          )}
        </div>
      </m.div>

      <m.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6 border border-border p-6"
      >
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          <UserIcon className="h-3.5 w-3.5" />
          Account Information
        </div>
        <div className="space-y-3">
          <m.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="flex items-center gap-3 border border-border px-4 py-3"
          >
            <Fingerprint className="h-4 w-4 shrink-0 text-text-muted" />
            <div className="flex-1">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">User ID</span>
              <div className="text-sm text-text font-mono">
                {user?.id || '---'}
              </div>
            </div>
          </m.div>
          <m.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3 border border-border px-4 py-3"
          >
            <Calendar className="h-4 w-4 shrink-0 text-text-muted" />
            <div className="flex-1">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Account Created</span>
              <div className="text-sm text-text">
                {user?.createdAt ? formatDate(user.createdAt) : '---'}
              </div>
            </div>
          </m.div>
          <m.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="flex items-center gap-3 border border-border px-4 py-3"
          >
            <Shield className="h-4 w-4 shrink-0 text-text-muted" />
            <div className="flex-1">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Authentication</span>
              <div className="text-sm text-text">
                SIWE (EIP-4361) Wallet Auth
              </div>
            </div>
          </m.div>
        </div>
      </m.div>

      <m.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-6 border border-border p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
            <Key className="h-3.5 w-3.5" />
            API Keys
          </div>
          <m.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 border border-amber/30 px-3 py-1.5 text-[10px] font-semibold text-amber transition-all hover:bg-amber/5 disabled:opacity-40"
          >
            {loggingOut ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <LogOut className="h-3 w-3" />
            )}
            Logout
          </m.button>
        </div>

        <div className="space-y-2">
          {apiKeys.length === 0 ? (
            <div className="border border-border px-4 py-6 text-center">
              <p className="text-sm text-text-muted">No API keys yet. Connect your wallet to generate one.</p>
            </div>
          ) : (
            apiKeys.map((key, index) => (
              <m.div
                key={key.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + index * 0.05 }}
                className="flex items-center gap-3 border border-border px-4 py-3"
              >
                <Key className="h-4 w-4 shrink-0 text-text-muted" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">{key.name}</span>
                    {key.name === 'Default wallet key' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue/10 px-2 py-0.5 text-[9px] font-bold text-blue">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-text-muted mt-0.5">
                    <span className="font-mono">{key.prefix}***</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDate(key.createdAt)}
                    </span>
                    {key.lastUsedAt && (
                      <span className="flex items-center gap-1">
                        Last used: {formatDate(key.lastUsedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <m.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCopy(key.prefix, key.id)}
                  className="rounded-lg p-2.5 transition-colors hover:bg-surface"
                >
                  {copied === key.id ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-text-muted" />
                  )}
                </m.button>
              </m.div>
            ))
          )}
        </div>
      </m.div>

      <m.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mb-6 border border-border p-6"
      >
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
          <Clock className="h-3.5 w-3.5" />
          Sessions
        </div>

        <div className="space-y-2">
          {sessions.length === 0 ? (
            <div className="border border-border px-4 py-6 text-center">
              <p className="text-sm text-text-muted">No active sessions.</p>
            </div>
          ) : (
            sessions.map((session, index) => (
              <m.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                className="flex items-center gap-3 border border-border px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/20 bg-accent/5">
                  <Fingerprint className="h-4 w-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text">{session.device}</span>
                    {session.current && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[9px] font-bold text-success">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-text-muted mt-0.5">
                    <span>{session.ip}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      Last active: {formatDate(session.lastActive)}
                    </span>
                  </div>
                </div>
              </m.div>
            ))
          )}
        </div>
      </m.div>

      <m.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="border border-red/20 p-6"
      >
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-red">
          <ShieldOff className="h-3.5 w-3.5" />
          Danger Zone
        </div>

        <div className="border border-red/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red mb-1">Delete Account</h3>
              <p className="text-xs text-text-muted mb-4">
                Permanently delete your OMA account, all API keys, credits, and staking positions.
                This action cannot be undone. Credits are non-redeemable and will be forfeited.
              </p>

              <AnimatePresence mode="wait">
                {!showDeleteConfirm ? (
                  <m.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-1.5 border border-red bg-red px-4 py-2 text-xs font-semibold text-text-inverse transition-all hover:bg-red/90"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Account
                  </m.button>
                ) : (
                  <m.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="border border-red/40 p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-red" />
                      <span className="text-sm font-bold text-red">Final Confirmation</span>
                    </div>
                    <p className="text-xs text-text-muted mb-4">
                      Are you absolutely sure? All data will be permanently destroyed.
                      Remaining credits will be burned. Staked OMA will be returned after cooldown.
                    </p>
                    <div className="flex gap-2">
                      <m.button
                        whileTap={{ scale: 0.98 }}
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                        className="inline-flex items-center justify-center gap-2 border border-red bg-red px-6 py-3 text-xs font-semibold text-text-inverse disabled:opacity-40"
                      >
                        {deleting ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
                        ) : (
                          'Yes, Delete Everything'
                        )}
                      </m.button>
                      <m.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deleting}
                        className="flex-1 border border-border py-3 text-xs font-semibold text-text transition-all hover:bg-surface"
                      >
                        Cancel
                      </m.button>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </m.div>
    </div>
  )
}
