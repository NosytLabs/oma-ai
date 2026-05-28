'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { api, type ApiKey, type ApiKeyWithSecret, type BalanceResponse, type UsageRecord, type CreditBatch, BackendUnavailableError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { useWallet } from '@/components/wallet-provider'
import { generateUsageData, generateModelData } from '@/components/ui/charts'

const LazyUsageChart = dynamic(
  () => import('@/components/dashboard/UsageChart').then(mod => mod.UsageChart),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[var(--color-border)]">
        <div className="bg-[var(--color-void)] p-6">
          <Skeleton className="h-4 w-20 mb-4" />
          <Skeleton className="h-[300px] w-full" />
        </div>
        <div className="bg-[var(--color-void)] p-6">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-[280px] w-full" />
        </div>
      </div>
    )
  }
)

const LazyConnectWalletView = dynamic(
  () => import('@/components/dashboard/ConnectWalletView').then(mod => mod.ConnectWalletView),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
)

const LazyCreditBalanceCard = dynamic(
  () => import('@/components/dashboard/CreditBalanceCard').then(mod => mod.CreditBalanceCard),
  { ssr: false, loading: () => <Skeleton className="h-32 w-full" /> }
)

const LazyExpiringCreditsWarning = dynamic(
  () => import('@/components/dashboard/ExpiringCreditsWarning').then(mod => mod.ExpiringCreditsWarning),
  { ssr: false, loading: () => <Skeleton className="h-32 w-full" /> }
)

const LazyQuickStatsCard = dynamic(
  () => import('@/components/dashboard/QuickStatsCard').then(mod => mod.QuickStatsCard),
  { ssr: false, loading: () => <Skeleton className="h-32 w-full" /> }
)

const LazyProviderHealthCard = dynamic(
  () => import('@/components/dashboard/ProviderHealthCard').then(mod => mod.ProviderHealthCard),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
)

const LazyApiKeyManager = dynamic(
  () => import('@/components/dashboard/ApiKeyManager').then(mod => mod.ApiKeyManager),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
)

const LazyRecentRequestsTable = dynamic(
  () => import('@/components/dashboard/RecentRequestsTable').then(mod => mod.RecentRequestsTable),
  { ssr: false, loading: () => <Skeleton className="h-48 w-full" /> }
)

const LazyCreatedKeyModal = dynamic(
  () => import('@/components/dashboard/CreatedKeyModal').then(mod => mod.CreatedKeyModal),
  { ssr: false, loading: () => null }
)

import { WifiOff, RefreshCw } from 'lucide-react'

export default function DashboardPage() {
  const { isConnected, connectEvm } = useWallet()
  const toast = useToast()

  const [balance, setBalance] = useState<BalanceResponse | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [usage, setUsage] = useState<UsageRecord[]>([])
  const [creditBatches, setCreditBatches] = useState<CreditBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [backendError, setBackendError] = useState(false)

  const usageData = useMemo(() => generateUsageData(7), [])
  const modelData = useMemo(() => generateModelData(), [])

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    setError(null)
    setBackendError(false)
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
      if (e instanceof BackendUnavailableError) {
        setBackendError(true)
        setError('Backend server unavailable')
      } else {
        const msg = e instanceof Error ? e.message : 'Failed to load dashboard data'
        setError(msg)
      }
    } finally {
      setLoading(false)
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
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard')
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    }).catch((err) => {
      console.error('Failed to copy:', err)
      toast.error('Failed to copy to clipboard. Please check your browser permissions.')
    })
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
      <>
        <h1 className="sr-only">Dashboard</h1>
        <LazyConnectWalletView onConnect={connectEvm} />
      </>
    )
  }

  return (
    <div>
      <h1 className="sr-only">Dashboard</h1>
      <main id="dashboard-content" className="min-h-screen bg-[var(--color-void)] text-[var(--color-text-secondary)] font-mono selection:bg-[var(--color-surface)] selection:text-[var(--color-text)]">
        <div className="p-4 md:p-8 pt-20">

        {error && (
          <div className="mb-6 flex items-center justify-between border border-[var(--color-accent-dim)] bg-[var(--color-error-bg)] p-4 text-xs uppercase tracking-widest text-[var(--color-error)]">
            <div className="flex items-center gap-3">
              {backendError ? (
                <>
                  <WifiOff className="h-4 w-4" />
                  <span>Backend unavailable</span>
                  <span className="text-[var(--color-text-muted)] normal-case tracking-normal">| Ensure server is running on port 3001</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-2 w-2 bg-[var(--color-error)] animate-pulse" />
                  ERR: {error}
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {backendError && (
                <button 
                  onClick={() => fetchData(true)} 
                  className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--color-error)]/50 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors text-sm font-medium"
                >
                  <RefreshCw className="h-3 w-3" />
                  RETRY
                </button>
              )}
              <button onClick={() => setError(null)} className="text-[var(--color-error)] hover:text-[var(--color-error)]/80 transition-colors">
                [CLEAR]
              </button>
            </div>
          </div>
        )}

        {/* Top Cards Grid */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-px bg-[var(--color-surface)]">
          <LazyCreditBalanceCard balance={balance} loading={loading} />
          {creditBatches.length > 0 && <LazyExpiringCreditsWarning creditBatches={creditBatches} />}
          <LazyQuickStatsCard
            loading={loading}
            todayRequests={todayUsage.length}
            todayCost={todayCost}
            activeModels={activeModels}
          />
        </div>

        {/* Usage Charts */}
        <div className="mb-6">
          <LazyUsageChart usageData={usageData} modelData={modelData} />
        </div>

        {/* Provider Health */}
        <div className="mb-6 border border-[var(--color-border)] bg-[var(--color-void)]">
          <LazyProviderHealthCard />
        </div>

        {/* API Keys */}
        <div className="mb-6 border border-[var(--color-border)] bg-[var(--color-void)]">
          <LazyApiKeyManager
            keys={keys}
            loading={loading}
            creating={creating}
            showCreateForm={showCreateForm}
            newKeyName={newKeyName}
            copied={copied}
            revokingId={revokingId}
            onCopy={handleCopy}
            onRevokeKey={handleRevokeKey}
            onCreateKey={handleCreateKey}
            setShowCreateForm={setShowCreateForm}
            setNewKeyName={setNewKeyName}
          />
        </div>

        {/* Recent Requests */}
        <div className="border border-[var(--color-border)] bg-[var(--color-void)]">
          <LazyRecentRequestsTable
            usage={usage}
            loading={loading}
            page={page}
            limit={limit}
            onPageChange={setPage}
          />
        </div>

        <Suspense fallback={null}>
          <LazyCreatedKeyModal
            createdKey={createdKey}
            copied={copied}
            onCopy={handleCopy}
            onDismiss={() => setCreatedKey(null)}
          />
        </Suspense>
      </div>
    </main>
    </div>
  )
}