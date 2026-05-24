'use client'

import { useWallet } from '@/components/wallet-provider'
import { api, type ApiKey, type ApiKeyWithSecret, type BalanceResponse, type UsageRecord, type CreditBatch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { AreaChartComponent, generateUsageData, DonutChart, generateModelData } from '@/components/ui/charts'
import { SkeletonKeyList } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { formatCents, formatTime, maskKey } from '@/lib/utils'
import {
  Wallet,
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  X,
  Activity,
  Zap,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Coins,
  TrendingUp,
  Server,
} from 'lucide-react'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

interface ProviderHealth {
  name: string
  status: 'operational' | 'degraded' | 'outage'
  latency: number
}

const PROVIDERS: ProviderHealth[] = [
  { name: 'Venice', status: 'operational', latency: 45 },
  { name: 'OpenRouter', status: 'operational', latency: 78 },
]

export default function DashboardPage() {
  const { isConnected, connectEvm } = useWallet()
  const toast = useToast()

  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [usage, setUsage] = useState<UsageRecord[]>([])
  const [creditBatches, setCreditBatches] = useState<CreditBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const usageData = useMemo(() => generateUsageData(7), [])
  const modelData = useMemo(() => generateModelData(), [])

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const [bal, keyList, usageData, batchData] = await Promise.all([
        api.oma.getBalance(),
        api.oma.getApiKeys(),
        api.oma.getUsage(),
        api.oma.getCreditBatches(),
      ])
      setBalance(bal)
      setKeys(keyList)
      setUsage(usageData.usage)
      setCreditBatches(batchData.activeBatches)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load dashboard data'
      setError(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!isConnected) return
    fetchData(true)
  }, [isConnected, fetchData])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && page > 1) setPage(p => p - 1)
      else if (e.key === 'ArrowRight' && usage.length > page * limit) setPage(p => p + 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [page, limit, usage.length])

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
      await api.oma.revokeApiKey(keyId)
      setKeys((prev) => prev.filter((k) => k.id !== keyId))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to revoke key'
      setError(msg)
    } finally {
      setRevokingId(null)
    }
  }, [])

  const todayUsage = useMemo(() => {
    const today = new Date().toDateString()
    return usage.filter(u => new Date(u.createdAt).toDateString() === today)
  }, [usage])

  const todayCost = useMemo(() => {
    return todayUsage.reduce((sum, u) => sum + parseFloat(String(u.costCents)), 0) / 100
  }, [todayUsage])

  const activeModels = useMemo(() => {
    const models = new Set(usage.map(u => u.model))
    return models.size
  }, [usage])

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
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-amber-500/10"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <Wallet className="h-10 w-10 text-cyan-500" />
          </motion.div>
          <h2 className="mb-3 text-2xl font-bold">Connect Your Wallet</h2>
          <p className="mb-6 text-zinc-500">
            Sign in to view your credits, usage stats, and manage API keys.
          </p>
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
      className="mx-auto max-w-7xl px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div 
        className="mb-8 flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Credits, usage, and API key management
          </p>
        </div>
        <motion.button
          onClick={() => fetchData()}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2 py-2 px-4"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </motion.button>
      </motion.div>

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
            <button onClick={() => setError(null)} className="ml-auto text-zinc-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <motion.div
          className="lg:col-span-2 rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-6 relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Coins className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Credit Balance</h2>
              <p className="text-xs text-zinc-500">Current balance</p>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-5xl font-bold tracking-tight text-white mb-1">
              {loading && !balance ? (
                <span className="text-zinc-600">$0.00</span>
              ) : (
                <AnimatedNumber value={parseFloat(formatCents(balance?.balanceCents ?? '0'))} />
              )}
            </div>
            <div className="text-sm text-zinc-500">
              {balance ? `${formatCents(balance.totalDepositedCents)} total deposited` : 'No deposits yet'}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/credits" className="btn-primary flex items-center gap-2 py-3 px-6">
              <Coins className="h-4 w-4" />
              Buy Credits
            </Link>
            <Link href="/deposit" className="btn-secondary flex items-center gap-2 py-3 px-6">
              <Plus className="h-4 w-4" />
              Add Funds
            </Link>
          </div>
        </motion.div>

      {/* Expiring Credits Warning */}
      {creditBatches.length > 0 && (() => {
        const now = new Date()
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        const expiringBatches = creditBatches.filter(b => {
          const expDate = new Date(b.expiresAt)
          return expDate <= thirtyDaysFromNow && expDate > now
        })
        if (expiringBatches.length === 0) return null
        return (
          <motion.div
            className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-500 mb-2">Credits Expiring Soon</h3>
                <div className="space-y-2">
                  {expiringBatches.map(batch => {
                    const expDate = new Date(batch.expiresAt)
                    const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
                    return (
                      <div key={batch.id} className="flex items-center justify-between text-sm">
                        <span className="text-zinc-300">
                          ${(parseInt(batch.remainingCents) / 100).toFixed(2)} credits
                        </span>
                        <span className="text-amber-400 font-medium">
                          {daysLeft === 0 ? 'Expires today' : daysLeft === 1 ? 'Expires tomorrow' : `Expires in ${daysLeft} days`}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <Link href="/dashboard/credits" className="mt-3 inline-block text-xs text-amber-400 hover:text-amber-300">
                  Buy more credits to avoid interruption
                </Link>
              </div>
            </div>
          </motion.div>
        )
      })()}


        <motion.div
          className="rounded-2xl border border-zinc-800/50 bg-zinc-900/50 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Quick Stats</h2>
              <p className="text-xs text-zinc-500">Today</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Activity className="h-4 w-4" />
                Requests
              </div>
              <span className="text-lg font-bold text-white">{loading ? '...' : todayUsage.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <CreditCard className="h-4 w-4" />
                Spend
              </div>
              <span className="text-lg font-bold text-amber-400">
                {loading ? '...' : `$${todayCost.toFixed(2)}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Server className="h-4 w-4" />
                Active Models
              </div>
              <span className="text-lg font-bold text-cyan-400">{loading ? '...' : activeModels}</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div
          className="rounded-2xl border border-zinc-800/50 bg-zinc-900/50 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">7-Day Usage</h3>
            <Link href="/dashboard/credits" className="text-xs text-cyan-400 hover:text-cyan-300">View details</Link>
          </div>
          <AreaChartComponent data={usageData} />
        </motion.div>

        <motion.div
          className="rounded-2xl border border-zinc-800/50 bg-zinc-900/50 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Model Usage</h3>
            <Link href="/dashboard/credits" className="text-xs text-cyan-400 hover:text-cyan-300">Breakdown</Link>
          </div>
          <DonutChart data={modelData} />
          <div className="mt-4 flex flex-wrap gap-3">
            {modelData.map((model) => (
              <div key={model.name} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: model.color }} />
                <span className="text-xs text-zinc-400">{model.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div 
        className="mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Provider Health</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROVIDERS.map((provider) => (
            <div
              key={provider.name}
              className="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  provider.status === 'operational' ? 'bg-emerald-500' :
                  provider.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <span className="font-medium text-white">{provider.name}</span>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  provider.status === 'operational' ? 'bg-emerald-500/10 text-emerald-400' :
                  provider.status === 'degraded' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {provider.status}
                </span>
                <span className="ml-3 text-xs text-zinc-500">{provider.latency}ms</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div 
        className="mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">API Keys</h2>
          <Link href="/dashboard/api-keys" className="text-sm text-cyan-400 hover:text-cyan-300">Manage all</Link>
        </div>

        <AnimatePresence>
          {showCreateForm && (
            <motion.div 
              className="mb-4 rounded-xl border border-cyan-500/30 bg-zinc-900/50 p-4"
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
                  className="flex-1 text-sm bg-transparent border-0 focus:outline-none text-white placeholder:text-zinc-600"
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
          <SkeletonKeyList count={2} />
        ) : keys.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/50 flex items-center justify-center py-12">
            <div className="text-center">
              <Key className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
              <span className="text-sm text-zinc-500">No API keys yet.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {keys.slice(0, 3).map((key, index) => (
                <motion.div
                  key={key.id}
                  className="rounded-xl border border-zinc-800/50 bg-zinc-900/50 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/50">
                      <Key className="h-5 w-5 text-cyan-500" />
                    </div>
                    <div>
                      <div className="font-bold text-white">{key.name}</div>
                      <div className="text-sm text-zinc-500 font-mono">{maskKey(key.prefix)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span>Created {key.createdAt ? new Date(key.createdAt).toLocaleDateString() : 'N/A'}</span>
                    <motion.button
                      onClick={() => handleCopy(key.prefix, `prefix-${key.id}`)}
                      className="rounded-lg p-2 transition-colors hover:bg-zinc-800 hover:text-cyan-400"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {copied === `prefix-${key.id}` ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </motion.button>
                    <motion.button
                      onClick={() => handleRevokeKey(key.id)}
                      disabled={revokingId === key.id}
                      className="rounded-lg p-2 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                    >
                      {revokingId === key.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      <motion.div 
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
      >
        <h2 className="mb-4 text-lg font-semibold text-white">Recent Requests</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-900/50">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="border-b border-zinc-800/50 bg-zinc-800/30">
                  <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Model</th>
                  <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Input</th>
                  <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Output</th>
                  <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Cost</th>
                  <th className="px-6 py-4 text-xs font-medium text-zinc-500 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody>
                {loading && usage.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-500" />
                    </td>
                  </tr>
                ) : usage.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No inference calls yet. <Link href="/playground" className="text-cyan-400 hover:underline">Try the playground</Link>
                    </td>
                  </tr>
                ) : (
                  usage.slice((page - 1) * limit, page * limit).map((row, i) => (
                    <motion.tr
                      key={row.id}
                      className="border-b border-zinc-800/30 transition-colors hover:bg-zinc-800/20"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <td className="px-6 py-4 text-sm font-medium text-cyan-400">{row.model}</td>
                      <td className="px-6 py-4 text-sm text-zinc-300">{row.promptTokens.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-zinc-300">{row.completionTokens.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-amber-400">${(parseFloat(String(row.costCents)) / 100).toFixed(4)}</td>
                      <td className="px-6 py-4 text-sm text-zinc-500">{formatTime(row.createdAt)}</td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && usage.length > limit && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/50">
              <span className="text-sm text-zinc-500">
                Showing {(page - 1) * limit + 1}-{Math.min(page * limit, usage.length)} of {usage.length}
              </span>
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </motion.button>
                <span className="text-sm font-medium px-2">{page}</span>
                <motion.button
                  onClick={() => setPage(p => Math.min(Math.ceil(usage.length / limit), p + 1))}
                  disabled={page >= Math.ceil(usage.length / limit)}
                  className="p-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ChevronRight className="h-4 w-4" />
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {createdKey && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-zinc-900 p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10">
                  <Key className="h-6 w-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">API Key Created</h3>
                  <p className="text-xs text-zinc-500">Copy this key now - it will not be shown again</p>
                </div>
              </div>

              <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="text-sm text-amber-500">This key will only be shown once. Copy it now.</span>
              </div>

              <div className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 p-4">
                <code className="flex-1 break-all text-sm text-cyan-400 font-mono">{createdKey.key}</code>
                <motion.button
                  onClick={() => handleCopy(createdKey.key, `full-${createdKey.id}`)}
                  className="shrink-0 rounded-lg p-2 transition-colors hover:bg-zinc-800 hover:text-cyan-400"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {copied === `full-${createdKey.id}` ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
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