'use client'

import { useWallet } from '@/components/wallet-provider'
import { api, type ApiKey, type ApiKeyWithSecret, type BalanceResponse, type UsageRecord } from '@/lib/api'
import {
  Wallet,
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  RefreshCw,
  X,
  Activity,
  Zap,
  ArrowRight,
  CreditCard,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STAKING_TIERS = [
  { stake: 0, discount: 0, label: 'None', color: 'bg-zinc-500' },
  { stake: 1000, discount: 3, label: 'Bronze', color: 'bg-amber-600' },
  { stake: 10000, discount: 6, label: 'Silver', color: 'bg-slate-400' },
  { stake: 50000, discount: 10, label: 'Gold', color: 'bg-yellow-500' },
  { stake: 100000, discount: 15, label: 'Platinum', color: 'bg-indigo-500' },
]

function getTier(discount: number) {
  for (let i = STAKING_TIERS.length - 1; i >= 0; i--) {
    if (discount >= STAKING_TIERS[i].discount) return STAKING_TIERS[i]
  }
  return STAKING_TIERS[0]
}

function getNextTier(discount: number) {
  for (const tier of STAKING_TIERS) {
    if (tier.discount > discount) return tier
  }
  return null
}

function formatCents(cents: string | number): string {
  const n = typeof cents === 'string' ? parseFloat(cents) : cents
  return `$${(n / 100).toFixed(2)}`
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

function maskKey(prefix: string): string {
  return `${prefix}****`
}

export default function DashboardPage() {
  const { isConnected, connectEvm } = useWallet()

  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [usage, setUsage] = useState<UsageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null)

  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [bal, keyList, usageData] = await Promise.all([
        api.getBalance(),
        api.getApiKeys(),
        api.getUsage(),
      ])
      setBalance(bal)
      setKeys(keyList)
      setUsage(usageData.usage)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load dashboard data'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isConnected) return
    let cancelled = false
    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const [bal, keyList, usageData] = await Promise.all([
          api.getBalance(),
          api.getApiKeys(),
          api.getUsage(),
        ])
        if (cancelled) return
        setBalance(bal)
        setKeys(keyList)
        setUsage(usageData.usage)
      } catch (e: unknown) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Failed to load dashboard data'
        setError(msg)
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

  const handleCreateKey = useCallback(async () => {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const key = await api.createApiKey(newKeyName.trim())
      setCreatedKey(key)
      setNewKeyName('')
      setShowCreateForm(false)
      setKeys((prev) => [...prev, { id: key.id, name: key.name, prefix: key.prefix, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt }])
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
      await api.revokeApiKey(keyId)
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to revoke key'
      setError(msg)
    } finally {
      setRevokingId(null)
    }
  }, [])

  if (!isConnected) {
    return (
      <motion.div 
        className="flex min-h-[calc(100vh-4rem)] items-center justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center max-w-md px-4">
          <motion.div 
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <Wallet className="h-10 w-10 text-indigo-500" />
          </motion.div>
          <h2 className="mb-3 text-2xl font-bold">Connect Your Wallet</h2>
          <p className="mb-6 text-text-secondary">
            Sign in to view your account balance, manage API keys, and stake OMA.
          </p>
          <motion.button
            onClick={() => connectEvm()}
            className="btn-primary flex items-center gap-2 mx-auto py-3 px-8"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Zap className="h-4 w-4" />
            Connect EVM Wallet
          </motion.button>
        </div>
      </motion.div>
    )
  }

  const tier = getTier(balance?.stakingDiscount ?? 0)
  const nextTier = getNextTier(balance?.stakingDiscount ?? 0)
  const tierProgress = nextTier
    ? ((balance?.stakingDiscount ?? 0) / nextTier.discount) * 100
    : 100

  return (
    <motion.div 
      className="mx-auto max-w-6xl px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <motion.div 
        className="mb-8 flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage your credits and API keys
          </p>
        </div>
        <motion.button
          onClick={loadData}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 py-2 px-4"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </motion.button>
      </motion.div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div 
            className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-text-secondary hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards Row */}
      <motion.div 
        className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {/* Balance Card */}
        <motion.div 
          className="card shadow-floating relative overflow-hidden"
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl" />
          <div className="flex items-start justify-between relative">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
                <CreditCard className="h-4 w-4" />
                Credit Balance
              </div>
              <motion.div 
                className="text-4xl font-bold text-gradient"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {loading ? '---' : balance ? formatCents(balance.balanceCents) : '$0.00'}
              </motion.div>
              <div className="mt-1 text-xs text-text-secondary">USD Credits</div>
            </div>
          </div>
          <motion.div 
            className="mt-4"
            whileHover={{ scale: 1.02 }}
          >
            <a href="/deposit" className="btn-primary w-full flex items-center justify-center gap-2 py-2">
              <Plus className="h-4 w-4" />
              Deposit
            </a>
          </motion.div>
        </motion.div>

        {/* Staking Tier Card */}
        <motion.div 
          className="card shadow-floating relative overflow-hidden"
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl" />
          <div className="flex items-start gap-3 relative">
            <motion.div 
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${tier.color} bg-opacity-20 border border-${tier.color}/30`}
              initial={{ rotate: -10 }}
              animate={{ rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              <ShieldCheck className="h-6 w-6 text-indigo-500" />
            </motion.div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{tier.label} Tier</span>
                {tier.discount > 0 && (
                  <motion.span 
                    className="text-sm font-bold text-indigo-500"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring' }}
                  >
                    -{tier.discount}%
                  </motion.span>
                )}
              </div>
              {nextTier && (
                <>
                  <div className="mt-2 text-xs text-text-secondary">
                    Next: {nextTier.label} ({nextTier.stake.toLocaleString()} OMA)
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                    <motion.div 
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${tierProgress}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Quick Stats Card */}
        <motion.div 
          className="card shadow-floating"
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">Today&apos;s Usage</span>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">API Calls</span>
              <span className="font-bold">{loading ? '---' : usage.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">Total Cost</span>
              <span className="font-bold text-indigo-500">
                {loading ? '---' : `$${(usage.reduce((a, u) => a + parseFloat(String(u.costCents)), 0) / 100).toFixed(2)}`}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <a href="/stake" className="flex items-center justify-center gap-2 text-sm text-indigo-500 hover:text-indigo-400 transition-colors">
              Stake more for better rates <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </motion.div>
      </motion.div>

      {/* API Keys Section */}
      <motion.div 
        className="mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">API Keys</h2>
          {!showCreateForm && (
            <motion.button
              onClick={() => setShowCreateForm(true)}
              className="btn-primary flex items-center gap-2 py-2 px-4"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="h-4 w-4" />
              Create Key
            </motion.button>
          )}
        </div>

        {/* Create Key Inline Form */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div 
              className="card mb-4 border-indigo-500/30 bg-surface/50"
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
                  placeholder="Key name (e.g. production)"
                  className="flex-1 text-sm bg-transparent border-0 focus:outline-none"
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
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Key className="h-4 w-4" />
                  )}
                  Generate
                </motion.button>
                <button
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewKeyName('')
                  }}
                  className="btn-secondary py-2 px-4"
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Key List */}
        {keys.length === 0 && !loading ? (
          <div className="card flex items-center justify-center py-12 text-text-secondary">
            <div className="text-center">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <span className="text-sm">No API keys yet. Create one to get started.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {keys.map((key, index) => (
                <motion.div
                  key={key.id}
                  className="card shadow-floating flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="flex items-center gap-4">
                    <motion.div 
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-gradient-to-br from-indigo-500/10 to-purple-500/10"
                      initial={{ rotate: -5 }}
                      animate={{ rotate: 0 }}
                    >
                      <Key className="h-5 w-5 text-indigo-500" />
                    </motion.div>
                    <div>
                      <div className="font-bold">{key.name}</div>
                      <div className="text-sm text-text-secondary">
                        {maskKey(key.prefix)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-xs text-text-secondary">
                      Created {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                    {key.lastUsedAt && (
                      <span className="text-xs text-text-secondary">
                        Used {formatTime(key.lastUsedAt)}
                      </span>
                    )}
                    <motion.button
                      onClick={() => handleCopy(key.prefix, `prefix-${key.id}`)}
                      className="rounded-lg p-2 transition-colors hover:bg-indigo-500/10 hover:text-indigo-500"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {copied === `prefix-${key.id}` ? (
                        <Check className="h-4 w-4 text-indigo-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </motion.button>
                    <motion.button
                      onClick={() => handleRevokeKey(key.id)}
                      disabled={revokingId === key.id}
                      className="rounded-lg p-2 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {revokingId === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Usage Table */}
      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <h2 className="mb-4 text-lg font-bold tracking-tight">Recent Usage</h2>
        <motion.div 
          className="overflow-hidden rounded-2xl border border-border bg-panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
                  <th className="px-6 py-4 text-xs font-medium text-text-secondary">Model</th>
                  <th className="px-6 py-4 text-xs font-medium text-text-secondary">Input</th>
                  <th className="px-6 py-4 text-xs font-medium text-text-secondary">Output</th>
                  <th className="px-6 py-4 text-xs font-medium text-text-secondary">Cost</th>
                  <th className="px-6 py-4 text-xs font-medium text-text-secondary">Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-500" />
                    </td>
                  </tr>
                ) : usage.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-text-secondary">
                      No inference calls yet.
                    </td>
                  </tr>
                ) : (
                  usage.slice(0, 20).map((row, i) => (
                    <motion.tr
                      key={row.id}
                      className="border-b border-border/50 transition-colors hover:bg-indigo-500/5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-indigo-500">{row.model}</td>
                      <td className="px-6 py-4 text-sm">{row.promptTokens.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">{row.completionTokens.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm">{formatCents(row.costCents)}</td>
                      <td className="px-6 py-4 text-sm text-text-secondary">
                        {formatTime(row.createdAt)}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>

      {/* New Key Modal */}
      <AnimatePresence>
        {createdKey && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="card mx-4 w-full max-w-lg border-indigo-500/30"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10">
                  <Key className="h-6 w-6 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">API Key Created</h3>
                  <p className="text-xs text-text-secondary">Copy this key now - it won&apos;t be shown again</p>
                </div>
              </div>

              <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="text-sm text-amber-500">
                  This key will only be shown once. Copy it now.
                </span>
              </div>

              <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface p-4">
                <code className="flex-1 break-all text-sm text-indigo-500 font-mono">
                  {createdKey.key}
                </code>
                <motion.button
                  onClick={() => handleCopy(createdKey.key, `full-${createdKey.id}`)}
                  className="shrink-0 rounded-lg p-2 transition-colors hover:bg-indigo-500/10 hover:text-indigo-500"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {copied === `full-${createdKey.id}` ? (
                    <Check className="h-5 w-5 text-indigo-500" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </motion.button>
              </div>

              <motion.button
                onClick={() => setCreatedKey(null)}
                className="btn-primary w-full py-3"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                I Have Copied This Key
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}