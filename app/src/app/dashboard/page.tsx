'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ApiKey, type ApiKeyWithSecret, type BalanceResponse, type UsageRecord, type CreditBatch, BackendUnavailableError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { useWallet } from '@/components/wallet-provider'
import { mapUsageToChartData, mapUsageToModelData } from '@/lib/api/usage-chart'
import { formatTime } from '@/lib/utils'
import Link from 'next/link'

/**
 * C-C1: when the user is in demo mode (`oma-demo=1` cookie), every card
 * renders pre-baked data so the dashboard feels alive without hitting the
 * API. The wallet-provider's `isDemo` flag is true; queries below disable
 * themselves with `enabled: isConnected && !isDemo`.
 */
const DEMO_BALANCE: BalanceResponse = {
  balanceCents: '5000',
  totalDepositedCents: '5000',
  totalUsedCents: '0',
  lastActivityAt: null,
}
const DEMO_KEYS: ApiKey[] = [
  { id: 'demo-key-1', name: 'Demo API key', prefix: 'oma_demo_', createdAt: new Date().toISOString(), lastUsedAt: null },
]
const DEMO_USAGE: UsageRecord[] = Array.from({ length: 14 }).map((_, i) => {
  const day = new Date()
  day.setDate(day.getDate() - (13 - i))
  return {
    id: `demo-${i}`,
    model: ['llama-3.3-70b', 'claude-sonnet-4', 'gemini-2.5-pro', 'gpt-4o-mini'][i % 4],
    promptTokens: 200 + (i * 37) % 600,
    completionTokens: 100 + (i * 19) % 300,
    totalTokens: 300 + (i * 56) % 900,
    costCents: String(1 + (i * 3) % 12),
    createdAt: day.toISOString(),
    status: 'completed',
  } as unknown as UsageRecord
})
const DEMO_BATCHES: CreditBatch[] = []
const DEMO_MODELS: import('@/lib/api').Model[] = [
  { id: 'llama-3.3-70b', object: 'model', created: 0, owned_by: 'meta' },
  { id: 'claude-sonnet-4', object: 'model', created: 0, owned_by: 'anthropic' },
  { id: 'gemini-2.5-pro', object: 'model', created: 0, owned_by: 'google' },
  { id: 'gpt-4o-mini', object: 'model', created: 0, owned_by: 'openai' },
]

const LazyUsageChart = dynamic(
  () => import('@/components/dashboard/UsageChart').then(mod => mod.UsageChart),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border">
        <div className="bg-void p-6">
          <Skeleton className="h-4 w-20 mb-4" />
          <Skeleton className="h-[300px] w-full" />
        </div>
        <div className="bg-void p-6">
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
  const { isAuthenticated, isDemo, connectEvm, disconnect } = useWallet()
  const toast = useToast()
  const queryClient = useQueryClient()

  const balanceQuery = useQuery({
    queryKey: ['balance'],
    queryFn: () => api.oma.getBalance(),
    enabled: isAuthenticated && !isDemo,
    staleTime: 60_000,
  })
  const keysQuery = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => api.oma.getApiKeys(),
    enabled: isAuthenticated && !isDemo,
    staleTime: 60_000,
  })
  const usageQuery = useQuery({
    queryKey: ['usage'],
    queryFn: () => api.usage(),
    enabled: isAuthenticated && !isDemo,
    staleTime: 60_000,
  })
  const batchesQuery = useQuery({
    queryKey: ['creditBatches'],
    queryFn: () => api.oma.getCreditBatches(),
    enabled: isAuthenticated && !isDemo,
    staleTime: 60_000,
  })
  const modelsQuery = useQuery({
    queryKey: ['models'],
    queryFn: () => api.models(),
    enabled: isAuthenticated && !isDemo,
    staleTime: 300_000,
  })
  const transactionsQuery = useQuery({
    queryKey: ['recentTransactions'],
    queryFn: () => api.creditHistory.list(5),
    enabled: isAuthenticated && !isDemo,
    staleTime: 60_000,
  })

  // C-C1: in demo mode we never touch the network — every card reads from
  // the DEMO_* constants. `loading` is false because there's nothing to wait
  // for, and `error` is always null. Mutations are also disabled (see
  // handleCreateKey / handleRevokeKey which early-return when isDemo).
  const realKeys = useMemo<ApiKey[]>(() => keysQuery.data ?? [], [keysQuery.data])
  const realUsage = useMemo<UsageRecord[]>(() => usageQuery.data?.usage ?? [], [usageQuery.data?.usage])
  const realBatches = useMemo<CreditBatch[]>(() => batchesQuery.data?.activeBatches ?? [], [batchesQuery.data?.activeBatches])
  const realModels = useMemo(() => modelsQuery.data?.data ?? [], [modelsQuery.data?.data])
  const realTransactions = useMemo(() => transactionsQuery.data?.transactions ?? [], [transactionsQuery.data?.transactions])

  const balance: BalanceResponse | null = isDemo ? DEMO_BALANCE : balanceQuery.data ?? null
  const keys: ApiKey[] = isDemo ? DEMO_KEYS : realKeys
  const usage: UsageRecord[] = isDemo ? DEMO_USAGE : realUsage
  const creditBatches: CreditBatch[] = isDemo ? DEMO_BATCHES : realBatches
  const models = isDemo ? DEMO_MODELS : realModels
  const transactions = isDemo ? [] : realTransactions
  const loading = isDemo
    ? false
    : balanceQuery.isLoading || keysQuery.isLoading || usageQuery.isLoading || batchesQuery.isLoading || modelsQuery.isLoading || transactionsQuery.isLoading

  const anyError = balanceQuery.error || keysQuery.error || usageQuery.error || batchesQuery.error || modelsQuery.error || transactionsQuery.error
  const backendError = anyError instanceof BackendUnavailableError
  const error = anyError && !backendError
    ? (anyError instanceof Error ? anyError.message : 'Failed to load dashboard data')
    : null

  const [page, setPage] = useState(1)
  const limit = 20

  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const usageData = useMemo(() => mapUsageToChartData(usage), [usage])
  const modelData = useMemo(() => mapUsageToModelData(usage), [usage])

  const thisMonthUsage = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    return usage.filter(u => new Date(u.createdAt) >= startOfMonth)
  }, [usage])
  const lastMonthUsage = useMemo(() => {
    const now = new Date()
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return usage.filter(u => {
      const d = new Date(u.createdAt)
      return d >= startOfLastMonth && d < startOfThisMonth
    })
  }, [usage])
  const thisMonthRequests = thisMonthUsage.length
  const lastMonthRequests = lastMonthUsage.length
  const thisMonthCost = thisMonthUsage.reduce((sum, u) => sum + parseFloat(String(u.costCents)), 0) / 100
  const lastMonthCost = lastMonthUsage.reduce((sum, u) => sum + parseFloat(String(u.costCents)), 0) / 100

  const refetchAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['balance'] })
    queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
    queryClient.invalidateQueries({ queryKey: ['usage'] })
    queryClient.invalidateQueries({ queryKey: ['creditBatches'] })
    queryClient.invalidateQueries({ queryKey: ['recentTransactions'] })
    queryClient.invalidateQueries({ queryKey: ['models'] })
    setLastUpdated(new Date())
  }, [queryClient])

  useEffect(() => {
    if (balance || keys.length > 0 || usage.length > 0) {
      setLastUpdated(new Date())
    }
  }, [balance, keys, usage])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bail out when the user is typing in any text-like input — arrow keys
      // must move the cursor there, not paginate the table.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }
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
    if (isDemo) {
      toast.error('Demo mode is read-only. Sign up to create real API keys.')
      return
    }
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const key = await api.oma.createApiKey(newKeyName.trim())
      setCreatedKey(key)
      setNewKeyName('')
      setShowCreateForm(false)
      queryClient.setQueryData<ApiKey[]>(['apiKeys'], (prev) => [
        ...(prev ?? []),
        { id: key.id, name: key.name, prefix: key.prefix, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt },
      ])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create key'
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }, [isDemo, newKeyName, queryClient, toast])

  const handleRevokeKey = useCallback(async (keyId: string) => {
    if (isDemo) {
      toast.error('Demo mode is read-only. Sign up to manage real API keys.')
      return
    }
    setRevokingId(keyId)
    try {
      await api.oma.revokeApiKey(keyId)
      queryClient.setQueryData<ApiKey[]>(['apiKeys'], (prev) => (prev ?? []).filter((k) => k.id !== keyId))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to revoke key'
      toast.error(msg)
    } finally {
      setRevokingId(null)
    }
  }, [isDemo, queryClient, toast])

  const todayUsage = useMemo(() => {
    const today = new Date().toDateString()
    return usage.filter(u => new Date(u.createdAt).toDateString() === today)
  }, [usage])

  const todayCost = useMemo(() => {
    return todayUsage.reduce((sum, u) => sum + parseFloat(String(u.costCents)), 0) / 100
  }, [todayUsage])

  const activeModels = useMemo(() => {
    return models.length
  }, [models])

  if (!isAuthenticated) {
    return (
      <>
        <h1 className="sr-only">Dashboard</h1>
        <LazyConnectWalletView onConnect={connectEvm} />
      </>
    )
  }

  return (
    <div>
      {isDemo && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-10 border-b border-amber/40 bg-amber/10 px-4 py-2 text-center text-xs text-amber"
        >
          <span className="font-semibold">Demo mode</span>
          {' — '}your changes won&apos;t be saved.{' '}
          <Link
            href="/login?method=wallet"
            className="underline underline-offset-2 hover:text-amber-bright"
          >
            Sign up to keep your work
          </Link>
          <button
            type="button"
            onClick={() => {
              if (typeof disconnect === 'function') {
                void disconnect()
              }
            }}
            className="ml-3 rounded border border-amber/40 px-2 py-0.5 text-[10px] uppercase tracking-widest hover:bg-amber/20"
            aria-label="Exit demo mode"
          >
            Exit demo
          </button>
        </div>
      )}
      <div id="dashboard-content" className="min-h-screen bg-void text-text-secondary font-mono selection:bg-surface selection:text-text">
        <div className="p-4 md:p-8 pt-4">
          <h1 className="h1-utility mb-8 text-text-bright">Dashboard</h1>

          <div className="mb-4 flex items-center gap-4 text-[10px] text-text-muted">
            <span className="flex items-center gap-1">
              {loading ? 'Syncing...' : lastUpdated ? `Last updated ${formatTime(lastUpdated.toISOString())}` : 'Awaiting data'}
            </span>
            {models.length > 0 && (
              <span className="flex items-center gap-1">
                {models.length} model{models.length !== 1 ? 's' : ''} available
              </span>
            )}
          </div>

        {error && (
          <div role="alert" aria-live="polite" className="mb-6 flex items-center justify-between border border-accent-dim bg-error-bg p-4 text-xs uppercase tracking-widest text-error">
            <div className="flex items-center gap-3">
              {backendError ? (
                <>
                  <WifiOff className="h-4 w-4" />
                  <span>Backend unavailable</span>
                  <span className="text-text-muted normal-case tracking-normal">| Ensure server is running on port 3001</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-2 w-2 bg-error animate-pulse" />
                  ERR: {error}
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              {backendError && (
                <button
                  onClick={() => refetchAll()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded border border-error/50 text-error hover:bg-error/10 transition-colors text-sm font-medium"
                >
                  <RefreshCw className="h-3 w-3" />
                  RETRY
                </button>
              )}
              <button onClick={() => refetchAll()} className="text-error hover:text-error/80 transition-colors">
                [CLEAR]
              </button>
            </div>
          </div>
        )}

        {/* Top Cards Grid */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-px bg-surface">
          <LazyCreditBalanceCard balance={balance} loading={loading} />
          {creditBatches.length > 0 && <LazyExpiringCreditsWarning creditBatches={creditBatches} />}
          <LazyQuickStatsCard
            loading={loading}
            todayRequests={todayUsage.length}
            todayCost={todayCost}
            activeModels={activeModels}
            requestDelta={thisMonthRequests - lastMonthRequests}
            costDelta={thisMonthCost - lastMonthCost}
          />
        </div>

        {/* Usage Charts */}
        <div className="mb-6">
          <LazyUsageChart usageData={usageData} modelData={modelData} />
        </div>

        {/* Provider Health */}
        <div className="mb-6 border border-border bg-void">
          <LazyProviderHealthCard />
        </div>

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <div className="mb-6 border border-border bg-void p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted">RECENT TRANSACTIONS</h2>
              <Link href="/dashboard/credits" className="text-[10px] text-accent hover:underline">View all</Link>
            </div>
            <div className="mt-3 space-y-1 text-xs text-text-muted">
              {transactions.slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                  <span className={tx.type === 'deposit' ? 'text-success' : tx.type === 'refund' ? 'text-accent' : 'text-warning'}>
                    {tx.type}
                  </span>
                  <span className="font-mono">{tx.type === 'usage' ? '-' : '+'}${(Math.abs(tx.amountCents) / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API Keys */}
        <div className="mb-6 border border-border bg-void">
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
        <div className="border border-border bg-void">
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
    </div>
    </div>
  )
}
