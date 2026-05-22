'use client'

import { useWallet } from '@/components/wallet-provider'
import { api, type User, type ApiKey } from '@/lib/api'
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
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [unlinkingEvm, setUnlinkingEvm] = useState(false)

  useEffect(() => {
    if (!isConnected) return
    let cancelled = false
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const [userData, keysData] = await Promise.all([
          api.auth.getUser(),
          api.auth.listKeys(),
        ])
        if (!cancelled) {
          setUser(userData)
          setApiKeys(keysData)
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

  if (!isConnected) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <motion.div 
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            <Wallet className="h-8 w-8 text-primary" />
          </motion.div>
          <h2 className="mb-2 text-xl font-bold tracking-tight">Connect Wallet</h2>
          <p className="mb-6 text-sm text-on-surface-variant">
            Authenticate to access account settings.
          </p>
          <div className="flex items-center justify-center gap-3">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => connectEvm()} 
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
            >
              <Hexagon className="h-4 w-4" />
              EVM / Base
            </motion.button>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-xs text-on-surface-variant">
          Account {loading ? 'Syncing...' : error ? 'Degraded' : 'Nominal'}
        </p>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 flex items-center gap-3 rounded-xl border border-error/30 bg-error/5 px-4 py-3"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-error" />
            <span className="text-sm text-on-surface">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-on-surface-variant hover:text-on-surface">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6 rounded-2xl border border-outline-variant/30 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <Wallet className="h-3.5 w-3.5" />
          Connected Wallets
        </div>

        <div className="space-y-3">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10">
              <Hexagon className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-bold">EVM Wallet</span>
                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-400">Base</span>
              </div>
              {evmAddress ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-primary break-all">{evmAddress}</span>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCopy(evmAddress, 'evm')}
                    className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-surface-container-high"
                  >
                    {copied === 'evm' ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-on-surface-variant" />
                    )}
                  </motion.button>
                </div>
              ) : (
                <span className="text-xs text-on-surface-variant">Not connected</span>
              )}
            </div>
            {evmAddress ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleUnlinkEvm}
                disabled={unlinkingEvm}
                className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 px-3 py-1.5 text-[10px] font-semibold text-secondary transition-all hover:bg-secondary/5 disabled:opacity-40"
              >
                {unlinkingEvm ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Unlink className="h-3 w-3" />
                )}
                Unlink
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => connectEvm()}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[10px] font-semibold text-white"
              >
                <Link2 className="h-3 w-3" />
                Connect
              </motion.button>
            )}
          </motion.div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6 rounded-2xl border border-outline-variant/30 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <UserIcon className="h-3.5 w-3.5" />
          Account Information
        </div>
        <div className="space-y-3">
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3"
          >
            <Fingerprint className="h-4 w-4 shrink-0 text-on-surface-variant" />
            <div className="flex-1">
              <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">User ID</span>
              <div className="text-sm text-on-surface font-mono">
                {user?.id || '---'}
              </div>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3"
          >
            <Calendar className="h-4 w-4 shrink-0 text-on-surface-variant" />
            <div className="flex-1">
              <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">Account Created</span>
              <div className="text-sm text-on-surface">
                {user?.createdAt ? formatDate(user.createdAt) : '---'}
              </div>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3"
          >
            <Shield className="h-4 w-4 shrink-0 text-on-surface-variant" />
            <div className="flex-1">
              <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">Authentication</span>
              <div className="text-sm text-on-surface">
                SIWE (EIP-4361) Wallet Auth
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-6 rounded-2xl border border-outline-variant/30 bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <Key className="h-3.5 w-3.5" />
            API Keys
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 px-3 py-1.5 text-[10px] font-semibold text-amber-500 transition-all hover:bg-amber-500/5 disabled:opacity-40"
          >
            {loggingOut ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <LogOut className="h-3 w-3" />
            )}
            Logout
          </motion.button>
        </div>

        <div className="space-y-2">
          {apiKeys.length === 0 ? (
            <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-6 text-center">
              <p className="text-sm text-on-surface-variant">No API keys yet. Connect your wallet to generate one.</p>
            </div>
          ) : (
            apiKeys.map((key, index) => (
              <motion.div
                key={key.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + index * 0.05 }}
                className="flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3"
              >
                <Key className="h-4 w-4 shrink-0 text-on-surface-variant" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{key.name}</span>
                    {key.name === 'Default wallet key' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-600">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-on-surface-variant mt-0.5">
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
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCopy(key.prefix + '...', key.id)}
                  className="rounded-lg p-1.5 transition-colors hover:bg-surface-container-high"
                >
                  {copied === key.id ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-on-surface-variant" />
                  )}
                </motion.button>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-error/20 bg-error/5 p-6"
      >
        <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-error">
          <ShieldOff className="h-3.5 w-3.5" />
          Danger Zone
        </div>

        <div className="rounded-xl border border-error/20 bg-white p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-error" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-error mb-1">Delete Account</h3>
              <p className="text-xs text-on-surface-variant mb-4">
                Permanently delete your OMA account, all API keys, credits, and staking positions.
                This action cannot be undone. Credits are non-redeemable and will be forfeited.
              </p>

              <AnimatePresence mode="wait">
                {!showDeleteConfirm ? (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-error px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-error/90"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Account
                  </motion.button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="rounded-xl border border-error/40 bg-surface-container-low p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-error" />
                      <span className="text-sm font-bold text-error">Final Confirmation</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mb-4">
                      Are you absolutely sure? All data will be permanently destroyed.
                      Remaining credits will be burned. Staked OMA will be returned after cooldown.
                    </p>
                    <div className="flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-error py-3 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        {deleting ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
                        ) : (
                          'Yes, Delete Everything'
                        )}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deleting}
                        className="flex-1 rounded-full border border-outline-variant py-3 text-xs font-semibold transition-all hover:bg-surface-container-low"
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}