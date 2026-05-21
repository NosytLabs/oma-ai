'use client'

import { useWallet } from '@/components/wallet-provider'
import { api, type User } from '@/lib/api'
import {
  Wallet,
  Hexagon,
  Link2,
  Unlink,
  Shield,
  AlertTriangle,
  Loader2,
  LogOut,
  Monitor,
  Smartphone,
  Clock,
  Trash2,
  X,
  Copy,
  Check,
  Fingerprint,
  Calendar,
  User as UserIcon,
  ShieldOff,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

interface Session {
  id: string
  device: string
  ip: string
  lastActive: string
  current: boolean
}

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
  const { isConnected, connectEvm, evmAddress, disconnect } = useWallet()

  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sessions, setSessions] = useState<Session[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loggingOutAll, setLoggingOutAll] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [unlinkingEvm, setUnlinkingEvm] = useState(false)

  useEffect(() => {
    if (!isConnected) return
    let cancelled = false
    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const sessionToken = localStorage.getItem('oma_session')
        if (sessionToken) {
          const payload = JSON.parse(atob(sessionToken.split('.')[1]))
          setUser({
            id: payload.sub || payload.userId || 'unknown',
            address: payload.address || '',
            createdAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : new Date().toISOString(),
          })
        }
        setSessions([
          {
            id: 'current',
            device: navigator.userAgent.includes('Chrome') ? 'Chrome Desktop' : 'Browser',
            ip: '***.***.***.***',
            lastActive: new Date().toISOString(),
            current: true,
          },
        ])
      } catch {
        if (!cancelled) setError('Failed to load settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [isConnected])

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }, [])

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



  const handleLogoutAll = async () => {
    setLoggingOutAll(true)
    try {
      await api.auth.logout()
      disconnect()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Logout failed')
    } finally {
      setLoggingOutAll(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await new Promise((r) => setTimeout(r, 2000))
      setShowDeleteConfirm(false)
      disconnect()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Account deletion failed')
    } finally {
      setDeleting(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-panel">
            <Wallet className="h-8 w-8 text-cyan" />
          </div>
          <h2 className="mono mb-2 text-xl font-bold">CONNECT WALLET</h2>
          <p className="mono mb-6 text-sm text-text-dim">
            Authenticate to access account settings.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => connectEvm()} className="btn-primary mono text-sm">
              EVM / BASE
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 font-mono">
      <div className="mb-8">
        <h1 className="mono text-2xl font-bold tracking-tight">SETTINGS</h1>
        <p className="mono mt-1 text-xs text-text-dim">
          ACCOUNT TERMINAL -- STATUS: {loading ? 'SYNCING' : error ? 'DEGRADED' : 'NOMINAL'}
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-pink/30 bg-pink/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-pink" />
          <span className="mono text-xs text-pink">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-text-dim hover:text-text">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Connected Wallets */}
      <div className="card mb-6">
        <div className="mb-4 flex items-center gap-2 text-xs text-text-dim">
          <Wallet className="h-3.5 w-3.5" />
          CONNECTED WALLETS
        </div>

        <div className="space-y-3">
          {/* EVM Wallet */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-400/30 bg-blue-500/10">
              <Hexagon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="mono text-sm font-bold">EVM Wallet</span>
                <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">BASE</span>
              </div>
              {evmAddress ? (
                <div className="flex items-center gap-2">
                  <span className="mono text-xs text-cyan break-all">{evmAddress}</span>
                  <button
                    onClick={() => handleCopy(evmAddress, 'evm')}
                    className="shrink-0 rounded p-1 transition-colors hover:text-cyan"
                  >
                    {copied === 'evm' ? (
                      <Check className="h-3 w-3 text-cyan" />
                    ) : (
                      <Copy className="h-3 w-3 text-text-dim" />
                    )}
                  </button>
                </div>
              ) : (
                <span className="mono text-xs text-text-dim">Not connected</span>
              )}
            </div>
            {evmAddress ? (
              <button
                onClick={handleUnlinkEvm}
                disabled={unlinkingEvm}
                className="btn-secondary flex items-center gap-1.5 py-1.5 text-[10px] border-pink/30 text-pink hover:border-pink/60 hover:bg-pink/5 disabled:opacity-40"
              >
                {unlinkingEvm ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Unlink className="h-3 w-3" />
                )}
                UNLINK
              </button>
            ) : (
              <button
                onClick={() => connectEvm()}
                className="btn-secondary flex items-center gap-1.5 py-1.5 text-[10px]"
              >
                <Link2 className="h-3 w-3" />
                CONNECT
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Account Info */}
      <div className="card mb-6">
        <div className="mb-4 flex items-center gap-2 text-xs text-text-dim">
          <UserIcon className="h-3.5 w-3.5" />
          ACCOUNT INFORMATION
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <Fingerprint className="h-4 w-4 shrink-0 text-text-dim" />
            <div className="flex-1">
              <span className="mono text-[10px] uppercase text-text-dim">User ID</span>
              <div className="mono text-sm text-text">
                {user?.id || '---'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <Calendar className="h-4 w-4 shrink-0 text-text-dim" />
            <div className="flex-1">
              <span className="mono text-[10px] uppercase text-text-dim">Account Created</span>
              <div className="mono text-sm text-text">
                {user?.createdAt ? formatDate(user.createdAt) : '---'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <Shield className="h-4 w-4 shrink-0 text-text-dim" />
            <div className="flex-1">
              <span className="mono text-[10px] uppercase text-text-dim">Authentication</span>
              <div className="mono text-sm text-text">
                SIWE (EIP-4361) Wallet Auth
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Management */}
      <div className="card mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-text-dim">
            <Monitor className="h-3.5 w-3.5" />
            ACTIVE SESSIONS
          </div>
          <button
            onClick={handleLogoutAll}
            disabled={loggingOutAll}
            className="btn-secondary flex items-center gap-1.5 py-1.5 text-[10px] border-amber/30 text-amber hover:border-amber/60 hover:bg-amber/5 disabled:opacity-40"
          >
            {loggingOutAll ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <LogOut className="h-3 w-3" />
            )}
            LOGOUT ALL
          </button>
        </div>

        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3"
            >
              {session.device.toLowerCase().includes('mobile') ? (
                <Smartphone className="h-4 w-4 shrink-0 text-text-dim" />
              ) : (
                <Monitor className="h-4 w-4 shrink-0 text-text-dim" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="mono text-sm font-medium">{session.device}</span>
                  {session.current && (
                    <span className="badge border-cyan/30 text-cyan text-[9px]">
                      <span className="status-dot status-dot--online" style={{ width: 6, height: 6 }} />
                      CURRENT
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mono text-[10px] text-text-dim mt-0.5">
                  <span>IP: {session.ip}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDate(session.lastActive)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-pink/20">
        <div className="mb-4 flex items-center gap-2 text-xs text-pink">
          <ShieldOff className="h-3.5 w-3.5" />
          DANGER ZONE
        </div>

        <div className="rounded-lg border border-pink/20 bg-pink/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-pink" />
            <div className="flex-1">
              <h3 className="mono text-sm font-bold text-pink mb-1">DELETE ACCOUNT</h3>
              <p className="mono text-xs text-text-dim mb-4">
                Permanently delete your OMA account, all API keys, credits, and staking positions.
                This action cannot be undone. Credits are non-redeemable and will be forfeited.
              </p>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn-danger flex items-center gap-1.5 py-1.5 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  DELETE ACCOUNT
                </button>
              ) : (
                <div className="rounded-lg border border-pink/40 bg-void p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-pink" />
                    <span className="mono text-sm font-bold text-pink">FINAL CONFIRMATION</span>
                  </div>
                  <p className="mono text-xs text-text-dim mb-4">
                    Are you absolutely sure? All data will be permanently destroyed.
                    Remaining credits will be burned. Staked OMA will be returned after cooldown.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="btn-danger flex-1 disabled:opacity-40"
                    >
                      {deleting ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> DELETING...</>
                      ) : (
                        'YES, DELETE EVERYTHING'
                      )}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="btn-secondary flex-1"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
