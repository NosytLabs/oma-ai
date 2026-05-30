'use client'

import { useWallet } from '@/components/wallet-provider'
import { api, type ApiKey, type ApiKeyWithSecret } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { SkeletonKeyList } from '@/components/ui/Skeleton'
import {
  Wallet,
  Key,
  Plus,
  Copy,
  Check,
  Settings,
  Trash2,
  AlertTriangle,
  Loader2,
  Zap,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

function maskKey(prefix: string): string {
  return `${prefix}****`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

interface RateLimit {
  requestsPerMinute: number
  requestsPerDay: number
}

export default function ApiKeysPage() {
  const { isConnected, connectEvm } = useWallet()
  const toast = useToast()

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null)

  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [editingLimits, setEditingLimits] = useState<string | null>(null)
  const [rateLimits, setRateLimits] = useState<Record<string, RateLimit>>({})

  const fetchKeys = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const keyList = await api.oma.getApiKeys()
      setKeys(keyList)
      const limits: Record<string, RateLimit> = {}
      keyList.forEach(k => {
        limits[k.id] = { requestsPerMinute: 60, requestsPerDay: 10000 }
      })
      setRateLimits(limits)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load API keys'
      setError(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!isConnected) return
    fetchKeys(true)
  }, [isConnected, fetchKeys])

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }, [toast])

  const handleCreateKey = useCallback(async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const key = await api.oma.createApiKey(newKeyName.trim())
      setCreatedKey(key)
      setNewKeyName('')
      setShowCreateForm(false)
      setKeys((prev) => [...prev, { 
        id: key.id, 
        name: key.name, 
        prefix: key.prefix, 
        createdAt: key.createdAt, 
        lastUsedAt: key.lastUsedAt 
      }])
      setRateLimits(prev => ({ ...prev, [key.id]: { requestsPerMinute: 60, requestsPerDay: 10000 } }))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create key'
      setError(msg)
    } finally {
      setCreating(false)
    }
  }, [newKeyName])

  const handleRevokeKey = useCallback(async (keyId: string) => {
    setRevokingId(keyId)
    try {
      await api.oma.revokeApiKey(keyId)
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
      toast.success('API key revoked')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to revoke key'
      setError(msg)
    } finally {
      setRevokingId(null)
    }
  }, [toast])

  const handleSaveLimits = useCallback(async (keyId: string) => {
    if (!keyId || !rateLimits[keyId]) return;
    const limits = rateLimits[keyId]!;
    try {
      await api.oma.updateApiKeyRateLimits(keyId, { rpm: limits.requestsPerMinute, tpm: limits.requestsPerDay });
      toast.success('Rate limits updated');
    } catch {
      toast.error('Failed to update rate limits');
    }
    setEditingLimits(null);
  }, [rateLimits, toast])

  if (!isConnected) {
    return (
      <motion.div 
        className="flex min-h-[calc(100vh-4rem)] items-center justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center max-w-md px-4">
          <motion.div 
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--color-cyan)]/30 bg-gradient-to-br from-[var(--color-cyan)]/10 to-[var(--color-warning)]/10"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
          >
            <Wallet className="h-10 w-10 text-[var(--color-cyan)]" />
          </motion.div>
          <h2 className="mb-3 text-2xl font-bold">Connect Your Wallet</h2>
          <p className="mb-6 text-[var(--color-text-muted)]">Connect your wallet to manage API keys.</p>
          <motion.button
            onClick={() => connectEvm()}
            className="btn-primary flex items-center gap-2 mx-auto py-3 px-8"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Zap className="h-4 w-4" />
            Connect Wallet
          </motion.button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="mx-auto max-w-5xl px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div 
        className="mb-8 flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/dashboard" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-cyan)]">Dashboard</Link>
            <span className="text-[var(--color-text-muted)]">/</span>
            <span className="text-sm text-white">API Keys</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">API Keys</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Manage your API keys and rate limits</p>
        </div>
        <motion.button
          onClick={() => setShowCreateForm(true)}
          className="btn-primary flex items-center gap-2 py-2 px-4"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="h-4 w-4" />
          Create Key
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div 
            className="mb-6 flex items-center gap-3 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--color-error)]" />
            <span className="text-sm text-[var(--color-error)]">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateForm && (
          <motion.div 
            className="mb-6 rounded-xl border border-[var(--color-cyan)]/30 bg-[var(--color-surface)] p-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
                placeholder="Key name (e.g. production, staging)"
                className="flex-1 text-sm bg-transparent border-0 focus:outline-none text-white placeholder:text-[var(--color-text-muted)]"
                autoFocus
                disabled={creating}
              />
              <motion.button
                onClick={handleCreateKey}
                disabled={creating || !newKeyName.trim()}
                className="btn-primary flex items-center gap-2 py-2 px-4 disabled:opacity-50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                Generate
              </motion.button>
              <button
                onClick={() => { setShowCreateForm(false); setNewKeyName('') }}
                className="btn-secondary py-2 px-4"
                disabled={creating}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && keys.length === 0 ? (
        <SkeletonKeyList count={3} />
      ) : keys.length === 0 ? (
        <motion.div 
          className="rounded-xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] flex items-center justify-center py-16"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="text-center">
            <Key className="h-12 w-12 mx-auto mb-4 text-[var(--color-text-muted)]" />
            <h3 className="text-lg font-semibold text-white mb-2">No API Keys Yet</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">Create your first API key to start making requests.</p>
            <motion.button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary flex items-center gap-2 mx-auto py-3 px-6"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="h-4 w-4" />
              Create API Key
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {keys.map((key, index) => (
              <motion.div
                key={key.id}
                className="rounded-xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-cyan)]/20 bg-[var(--color-cyan)]/10">
                      <Key className="h-6 w-6 text-[var(--color-cyan)]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{key.name}</h3>
                        <span className="font-mono text-sm text-[var(--color-text-muted)]">{maskKey(key.prefix)}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-text-muted)]">
                        <span>Created {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}</span>
                        {key.lastUsedAt && (
                          <>
                            <span className="text-[var(--color-text-muted)]">|</span>
                            <span>Last used {formatTime(key.lastUsedAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <motion.button
                      onClick={() => handleCopy(key.prefix, `prefix-${key.id}`)}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-cyan)]"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {copied === `prefix-${key.id}` ? (
                        <>
                          <Check className="h-4 w-4 text-[var(--color-green)]" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </motion.button>

                    <motion.button
                      onClick={() => setEditingLimits(editingLimits === key.id ? null : key.id)}
                      className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                        editingLimits === key.id 
                          ? 'border-[var(--color-cyan)] bg-[var(--color-cyan)]/10 text-[var(--color-cyan)]' 
                          : 'border-[var(--color-border)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-cyan)]'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Settings className="h-4 w-4" />
                      Limits
                    </motion.button>

                    <motion.button
                      onClick={() => handleRevokeKey(key.id)}
                      disabled={revokingId === key.id}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-error)] transition-colors hover:bg-[var(--color-error)]/10 hover:border-[var(--color-error)]/50 disabled:opacity-50"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {revokingId === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Revoke
                    </motion.button>
                  </div>
                </div>

                <AnimatePresence>
                  {editingLimits === key.id && (
                    <motion.div
                      className="mt-4 pt-4 border-t border-[var(--color-border)]/50"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Requests per Minute</label>
                          <input
                            type="number"
                            value={rateLimits[key.id]?.requestsPerMinute ?? 60}
                            onChange={(e) => setRateLimits(prev => ({
                              ...prev,
                              [key.id]: { ...prev[key.id], requestsPerMinute: parseInt(e.target.value) || 0 }
                            }))}
                            className="w-full text-sm font-medium bg-[var(--color-void)] border border-[var(--color-border)] rounded-lg px-4 py-2 focus:outline-none focus:border-[var(--color-cyan)]/50"
                            min={1}
                            max={10000}
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Requests per Day</label>
                          <input
                            type="number"
                            value={rateLimits[key.id]?.requestsPerDay ?? 10000}
                            onChange={(e) => setRateLimits(prev => ({
                              ...prev,
                              [key.id]: { ...prev[key.id], requestsPerDay: parseInt(e.target.value) || 0 }
                            }))}
                            className="w-full text-sm font-medium bg-[var(--color-void)] border border-[var(--color-border)] rounded-lg px-4 py-2 focus:outline-none focus:border-[var(--color-cyan)]/50"
                            min={1}
                            max={1000000}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-3">
                        <button
                          onClick={() => setEditingLimits(null)}
                          className="btn-secondary py-2 px-4"
                        >
                          Cancel
                        </button>
<motion.button
                          onClick={() => editingLimits && handleSaveLimits(editingLimits)}
                          className="btn-primary py-2 px-4"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Save Limits
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {createdKey && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full max-w-lg rounded-2xl border border-[var(--color-cyan)]/30 bg-[var(--color-surface)] p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10">
                  <Key className="h-6 w-6 text-[var(--color-cyan)]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">API Key Created</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">Copy this key now - it will not be shown again</p>
                </div>
              </div>

              <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--color-warning)]" />
                <span className="text-sm text-[var(--color-warning)]">This key will only be shown once. Copy it now.</span>
              </div>

              <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-void)] p-4">
                <code className="flex-1 break-all text-sm text-[var(--color-cyan)] font-mono">{createdKey.key}</code>
                <motion.button
                  onClick={() => handleCopy(createdKey.key, `full-${createdKey.id}`)}
                  className="shrink-0 rounded-lg p-2 transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-cyan)]"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {copied === `full-${createdKey.id}` ? <Check className="h-5 w-5 text-[var(--color-green)]" /> : <Copy className="h-5 w-5" />}
                </motion.button>
              </div>

              <div className="mb-6 p-4 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
                <h4 className="text-sm font-semibold text-white mb-3">Quick Start</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--color-cyan)] font-mono">curl</span>
                    <span className="text-[var(--color-text-muted)]">-X POST https://api.oma-ai.com/v1/chat/completions</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--color-text-muted)]">-H {`"`}Authorization: Bearer{`"`} </span>
                    <span className="text-[var(--color-warning)] font-mono">{createdKey.prefix}{'"'}...</span>
                  </div>
                </div>
              </div>

              <motion.button
                onClick={() => setCreatedKey(null)}
                className="btn-primary w-full py-3"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                I have copied this key
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}