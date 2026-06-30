'use client'

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Users, CreditCard, DollarSign, Key, TrendingUp, Activity, RefreshCw, Download, Eye, Zap, Clock, Gauge, Terminal, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { m } from 'framer-motion'
import { formatUsd, formatAddress, formatDateShort } from '@/lib/utils'
import { api } from '@/lib/api'
import { ApiError } from '@/lib/api/client'
import type { AdminUser } from '@/lib/api/admin'
import { ErrorBoundary } from '@/components/error-boundary'

const AdminOverviewCharts = dynamic(() => import('@/components/admin/AdminOverviewCharts').then(m => ({ default: m.AdminOverviewCharts })), { ssr: false })
const AdminRevenueChart = dynamic(() => import('@/components/admin/AdminRevenueCharts').then(m => ({ default: m.AdminRevenueCharts })), { ssr: false })

type Tab = 'overview' | 'users' | 'usage' | 'revenue' | 'keys' | 'fees' | 'rate-limits'

type UsageStats = {
  period: string
  summary: { totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalRevenue: number; totalCost: number; grossProfit: number; margin: string }
  byProvider: Array<{ provider: string; totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalRevenue: number; totalCost: number; profit: number }>
  byModel: Array<{ model: string; provider: string; totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalRevenue: number }>
  dailyUsage: Array<{ date: string; totalRequests: number; totalRevenue: number }>
}

type RevenueStats = {
  period: string
  summary: { totalRevenue: number; totalCost: number; grossProfit: number; totalDeposits: number; depositCount: number; newUsers: number }
  monthlyRevenue: Array<{ month: string; totalRevenue: number; depositCount: number }>
  dailyRevenue?: Array<{ date: string; revenue: number; cost: number }>
}

type ApiKey = {
  id: string
  userId: string
  userAddress: string
  keyPrefix: string
  name: string
  active: boolean
  createdAt: string
  totalRequests: number
  totalSpend: number
  lastUsedAt: string | null
}

type AdminStats = {
  totalUsers: number
  totalApiKeys: number
  totalDollarsPurchased: number
  totalUsageThisMonth: number
  revenue: number
  activeUsersLast24h: number
  providerCosts: {
    venice: number
    openrouter: number
  }
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [usersPage, setUsersPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [usagePeriod, setUsagePeriod] = useState('30d')
  const [revenuePeriod, setRevenuePeriod] = useState('30d')

  const queryClient = useQueryClient()

  const refreshStats = () => {
    queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
    queryClient.invalidateQueries({ queryKey: ['adminUsage'] })
    queryClient.invalidateQueries({ queryKey: ['adminRevenue'] })
    queryClient.invalidateQueries({ queryKey: ['adminKeys'] })
  }

  const usersQuery = useQuery({
    queryKey: ['adminUsers', usersPage],
    queryFn: () => api.admin.getUsers(usersPage, 50),
    staleTime: 30_000,
  })

  const usageQuery = useQuery({
    queryKey: ['adminUsage', usagePeriod],
    queryFn: () => api.admin.getUsage(usagePeriod),
    staleTime: 30_000,
  })

  const revenueQuery = useQuery({
    queryKey: ['adminRevenue', revenuePeriod],
    queryFn: () => api.admin.getRevenue(revenuePeriod),
    staleTime: 30_000,
  })

  const keysQuery = useQuery({
    queryKey: ['adminKeys'],
    queryFn: () => api.admin.getKeys(1, 100).then((data) => ((data as { keys?: ApiKey[] })?.keys ?? [])),
    staleTime: 30_000,
  })

  const users = useMemo(() => (usersQuery.data?.users ?? []) as AdminUser[], [usersQuery.data?.users])
  const usersLoading = usersQuery.isLoading
  const usersTotal = usersQuery.data?.pagination?.total ?? 0
  const usageStats: UsageStats | null = usageQuery.data ?? null
  const revenueStats = (revenueQuery.data ?? null) as RevenueStats | null
  const apiKeys: ApiKey[] = keysQuery.data ?? []

  const adminStats: AdminStats | null = useMemo(() => {
    if (!usageStats || !revenueStats || !usersQuery.data?.pagination) return null
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const activeUsersLast24h = users.filter((u) =>
      u.lastActivityAt && new Date(u.lastActivityAt) > last24h
    ).length
    return {
      totalUsers: usersQuery.data.pagination.total,
      totalApiKeys: apiKeys.length,
      totalDollarsPurchased: revenueStats.summary.totalDeposits,
      totalUsageThisMonth: usageStats.summary.totalRevenue,
      revenue: revenueStats.summary.totalRevenue - revenueStats.summary.totalCost,
      activeUsersLast24h,
      providerCosts: {
        venice: usageStats.byProvider.find((p) => p.provider === 'venice')?.totalCost ?? 0,
        openrouter: usageStats.byProvider.find((p) => p.provider === 'openrouter')?.totalCost ?? 0,
      },
    }
  }, [usageStats, revenueStats, usersQuery.data, users, apiKeys.length])

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users
    const q = searchQuery.toLowerCase()
    return users.filter(u => 
      u.address.toLowerCase().includes(q) ||
      u.accountNumber?.toLowerCase().includes(q)
    )
  }, [users, searchQuery])

  const exportCSV = (data: unknown[], filename: string) => {
    if (!data?.length) return
    const headers = Object.keys(data[0] as object)
    const csv = [headers.join(','), ...data.map(row => headers.map(h => JSON.stringify((row as Record<string, unknown>)[h] ?? '')).join(','))]
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const chartData = useMemo(() => {
    if (!revenueStats?.dailyRevenue && !revenueStats?.monthlyRevenue) return []
    if (revenueStats.dailyRevenue) return revenueStats.dailyRevenue
    return revenueStats.monthlyRevenue.map(m => ({
      date: m.month,
      revenue: m.totalRevenue,
      cost: 0,
    }))
  }, [revenueStats])

  const isUnauthorized = useMemo(() => {
    const errors = [usersQuery.error, usageQuery.error, revenueQuery.error, keysQuery.error]
    return errors.some((err) => err instanceof ApiError && err.status === 403)
  }, [usersQuery.error, usageQuery.error, revenueQuery.error, keysQuery.error])

  if (isUnauthorized) {
    return (
      <div className="min-h-screen bg-void text-text flex flex-col items-center justify-center px-4">
        <div className="rounded border border-border bg-surface p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded border border-red-300/30 bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold font-display tracking-tight text-text-bright mb-2">Not Authorized</h1>
          <p className="text-sm text-text-muted font-mono mb-6">
            You don&apos;t have admin access. This area is restricted to authorized administrators only.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text hover:border-border-bright transition-colors text-sm font-mono"
          >
            Return Home
           </Link>
        </div>
      </div>
   )
  }

  const content = (
    <div className="min-h-screen bg-void text-text">
      <div className="border-b border-border bg-surface">
        <div className="max-w-[95rem] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded border border-accent bg-accent-dim flex items-center justify-center">
                <Terminal className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h1 className="text-lg font-bold font-display tracking-tight text-text-bright">OMA Admin</h1>
                <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">Gateway Operations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-surface">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[11px] font-mono text-text-muted">LIVE</span>
              </div>
              <m.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => refreshStats()}
                className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text hover:border-border-bright transition-colors text-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </m.button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-border">
        <div className="max-w-[95rem] mx-auto px-4">
          <div role="tablist" aria-label="Admin sections" className="flex gap-0.5 overflow-x-auto scrollbar-none">
            {(['overview', 'users', 'usage', 'revenue', 'keys', 'fees', 'rate-limits'] as Tab[]).map((tab) => (
              <button type="button"
                key={tab}
                role="tab"
                id={`admin-tab-${tab}`}
                aria-selected={activeTab === tab}
                aria-controls="admin-tabpanel"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-xs font-medium font-mono uppercase tracking-wider transition-all border-b-2 whitespace-nowrap rounded-full ${
                  activeTab === tab
                    ? 'text-accent border-accent bg-accent-dim/30'
                    : 'text-text-muted border-transparent hover:text-text-secondary hover:bg-surface'
                }`}
              >
                {tab === 'overview' && <Activity className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />}
                {tab === 'users' && <Users className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />}
                {tab === 'usage' && <TrendingUp className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />}
                {tab === 'revenue' && <DollarSign className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />}
                {tab === 'keys' && <Key className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />}
                {tab === 'fees' && <DollarSign className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />}
                {tab === 'rate-limits' && <Gauge className="w-3.5 h-3.5 inline mr-1.5" aria-hidden="true" />}
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        id="admin-tabpanel"
        role="tabpanel"
        aria-labelledby={`admin-tab-${activeTab}`}
        tabIndex={0}
        className="max-w-[95rem] mx-auto px-4 py-6 focus:outline-none"
      >
        {activeTab === 'overview' && !adminStats && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded border border-accent/30 bg-accent/10 flex items-center justify-center mb-6">
              <Activity className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-xl font-bold font-mono text-text-bright mb-2">No Data Available</h2>
            <p className="text-sm text-text-muted font-mono max-w-md text-center mb-6">
              Admin statistics will appear here once there is user activity on the gateway. Connect your database and start the server to begin tracking.
            </p>
            <div className="flex items-center gap-3">
              <button type="button"
                onClick={() => refreshStats()}
                className="flex items-center gap-2 px-4 py-2 rounded border border-accent/30 bg-accent-dim text-accent hover:bg-accent/20 transition-colors text-sm font-mono"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Fetch
              </button>
              <Link
                href="/admin/fees"
                className="flex items-center gap-2 px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text hover:border-border-bright transition-colors text-sm font-mono"
              >
                Configure Fees
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'overview' && adminStats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Total Users</span>
                </div>
                <p className="text-2xl font-bold font-mono text-text-bright">{adminStats.totalUsers.toLocaleString()}</p>
              </div>
              <div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <Key className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">API Keys</span>
                </div>
                <p className="text-2xl font-bold font-mono text-text-bright">{adminStats.totalApiKeys.toLocaleString()}</p>
              </div>
              <div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Credits Purchased</span>
                </div>
                <p className="text-2xl font-bold font-mono text-success">{formatUsd(adminStats.totalDollarsPurchased)}</p>
              </div>
              <div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Usage This Month</span>
                </div>
                <p className="text-2xl font-bold font-mono text-amber">{formatUsd(adminStats.totalUsageThisMonth)}</p>
              </div>
              <div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Revenue</span>
                </div>
                <p className="text-2xl font-bold font-mono text-accent">{formatUsd(adminStats.revenue)}</p>
              </div>
              <div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Active (24h)</span>
                </div>
                <p className="text-2xl font-bold font-mono text-text-bright">{adminStats.activeUsersLast24h}</p>
              </div>
            </div>

            <div className="rounded border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">Provider Costs (This Month)</h3>
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded border border-border bg-panel">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded border border-blue/30 bg-blue/10 flex items-center justify-center">
                      <span className="text-[11px] font-bold font-mono text-blue">V</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-bright">Venice</p>
                      <p className="text-[10px] text-text-muted">Primary provider</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold font-mono text-amber">{formatUsd(adminStats.providerCosts.venice)}</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded border border-border bg-panel">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded border border-violet/30 bg-violet/10 flex items-center justify-center">
                      <span className="text-[11px] font-bold font-mono text-violet">OR</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-bright">OpenRouter</p>
                      <p className="text-[10px] text-text-muted">Backup provider</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold font-mono text-amber">{formatUsd(adminStats.providerCosts.openrouter)}</p>
                </div>
                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <p className="text-xs text-text-muted font-mono uppercase tracking-wider">Total Provider Costs</p>
                  <p className="text-lg font-bold font-mono text-text-bright">
                    {formatUsd(adminStats.providerCosts.venice + adminStats.providerCosts.openrouter)}
                  </p>
                </div>
              </div>
            </div>

            <AdminOverviewCharts chartData={chartData} dailyUsage={usageStats?.dailyUsage} />
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search by address or account number..."
                  aria-label="Search users by address or account number"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded border border-border bg-surface text-text placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
                <span>{usersTotal} total users</span>
              </div>
            </div>

            <div className="rounded border border-border bg-surface overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-panel">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">Top Models</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface">
                    <th className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider">Address</th>
                    <th className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider text-right">Balance</th>
                    <th className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider text-right">Total Deposited</th>
                    <th className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider text-right">Total Used</th>
                    <th className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider text-right">Requests</th>
                    <th className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider">Last Active</th>
                    <th className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-surface/50">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm text-text-secondary">{formatAddress(user.address)}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-accent">{formatUsd(user.balanceCredits)}</td>
                      <td className="px-4 py-3 text-right font-mono text-success">{formatUsd(user.totalDeposited)}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber">{formatUsd(user.totalUsed)}</td>
                      <td className="px-4 py-3 text-right font-mono text-text-muted">{user.totalRequests?.toLocaleString() || 0}</td>
                      <td className="px-4 py-3 text-text-muted font-mono text-xs">{user.lastActivityAt ? formatDateShort(user.lastActivityAt) : 'Never'}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="p-1.5 rounded hover:bg-panel text-text-muted hover:text-accent transition-colors inline-flex"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && !usersLoading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-text-muted font-mono">No users found</td>
                    </tr>
                  )}
                </tbody>
              </table></div>
            </div>

            <div className="flex items-center justify-between">
              <button type="button"
                onClick={() => setUsersPage(usersPage - 1)}
                disabled={usersPage <= 1}
                className="px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text hover:border-border-bright disabled:opacity-30 disabled:cursor-not-allowed disabled:border-border/50 disabled:text-text-muted text-sm font-mono transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-text-muted font-mono">Page {usersPage} of {Math.ceil(usersTotal / 50) || 1}</span>
              <button type="button"
                onClick={() => setUsersPage(usersPage + 1)}
                disabled={usersPage >= Math.ceil(usersTotal / 50)}
                className="px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text hover:border-border-bright disabled:opacity-30 disabled:cursor-not-allowed disabled:border-border/50 disabled:text-text-muted text-sm font-mono transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs text-text-muted font-mono uppercase tracking-wider">Period:</span>
                {['7d', '30d', '90d'].map((p) => (
                  <button type="button"
                    key={p}
                    onClick={() => { setUsagePeriod(p) }}
                    className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                      usagePeriod === p ? 'bg-accent-dim text-accent border border-accent/30' : 'bg-surface text-text-muted border border-border hover:text-text'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {usageStats && (
                <button type="button"
                  onClick={() => exportCSV(usageStats.dailyUsage, `usage-${usagePeriod}`)}
                  className="flex items-center gap-2 px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text text-sm font-mono transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              )}
            </div>

            {usageStats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded border border-border bg-surface p-5">
                    <p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">Total Requests</p>
                    <p className="text-2xl font-bold font-mono text-text-bright">{usageStats.summary.totalRequests.toLocaleString()}</p>
                  </div>
                  <div className="rounded border border-border bg-surface p-5">
                    <p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">Total Revenue</p>
                    <p className="text-2xl font-bold font-mono text-success">{formatUsd(usageStats.summary.totalRevenue)}</p>
                  </div>
                  <div className="rounded border border-border bg-surface p-5">
                    <p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">Total Cost</p>
                    <p className="text-2xl font-bold font-mono text-amber">{formatUsd(usageStats.summary.totalCost)}</p>
                  </div>
                  <div className="rounded border border-border bg-surface p-5">
                    <p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">Gross Profit</p>
                    <p className="text-2xl font-bold font-mono text-accent">{formatUsd(usageStats.summary.grossProfit)}</p>
                    <p className="text-[10px] text-text-muted font-mono mt-1">Margin: {usageStats.summary.margin}</p>
                  </div>
                </div>

                <div className="rounded border border-border bg-surface overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-panel">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">By Provider</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface/50">
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">Provider</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Requests</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Revenue</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Cost</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageStats.byProvider.map((p) => (
                        <tr key={p.provider} className="border-b border-border/50">
                          <td className="px-4 py-2 font-medium text-text-bright capitalize text-sm">{p.provider}</td>
                          <td className="px-4 py-2 text-right font-mono text-text-muted">{p.totalRequests.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-success">{formatUsd(p.totalRevenue)}</td>
                          <td className="px-4 py-2 text-right font-mono text-amber">{formatUsd(p.totalCost)}</td>
                          <td className="px-4 py-2 text-right font-mono text-accent">{formatUsd(p.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>

                <div className="rounded border border-border bg-surface overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-panel">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">Top Models</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface/50">
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">Model</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Requests</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Input Tokens</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Output Tokens</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageStats.byModel.map((m) => (
                        <tr key={m.model} className="border-b border-border/50">
                          <td className="px-4 py-2">
                            <div className="font-mono text-sm text-text-bright">{m.model}</div>
                            <div className="text-[10px] text-text-muted capitalize">{m.provider}</div>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-text-muted">{m.totalRequests.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-text-muted">{m.totalInputTokens.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-text-muted">{m.totalOutputTokens.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-success">{formatUsd(m.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <span className="text-xs text-text-muted font-mono uppercase tracking-wider">Period:</span>
              {['7d', '30d', '90d', 'all'].map((p) => (
                <button type="button"
                  key={p}
                    onClick={() => { setRevenuePeriod(p) }}
                  className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                    revenuePeriod === p ? 'bg-accent-dim text-accent border border-accent/30' : 'bg-surface text-text-muted border border-border hover:text-text'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {revenueStats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded border border-border bg-surface p-5">
                    <p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">Total Revenue</p>
                    <p className="text-2xl font-bold font-mono text-success">{formatUsd(revenueStats.summary.totalRevenue)}</p>
                  </div>
                  <div className="rounded border border-border bg-surface p-5">
                    <p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">Total Deposits</p>
                    <p className="text-2xl font-bold font-mono text-text-bright">{formatUsd(revenueStats.summary.totalDeposits)}</p>
                    <p className="text-[10px] text-text-muted font-mono mt-1">{revenueStats.summary.depositCount} transactions</p>
                  </div>
                  <div className="rounded border border-border bg-surface p-5">
                    <p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">Gross Profit</p>
                    <p className="text-2xl font-bold font-mono text-accent">{formatUsd(revenueStats.summary.grossProfit)}</p>
                  </div>
                  <div className="rounded border border-border bg-surface p-5">
                    <p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">New Users</p>
                    <p className="text-2xl font-bold font-mono text-text-bright">{revenueStats.summary.newUsers.toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AdminRevenueChart monthlyRevenue={revenueStats?.monthlyRevenue} />

                  <div className="rounded border border-border bg-surface overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-panel flex items-center justify-between">
                      <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">Monthly Breakdown</h3>
                      <button type="button"
                        onClick={() => exportCSV(revenueStats.monthlyRevenue, `revenue-${revenuePeriod}`)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-surface text-text-muted hover:text-text text-[11px] font-mono"
                      >
                        <Download className="w-3 h-3" /> Export
                      </button>
                    </div>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border bg-surface/50">
                          <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">Month</th>
                          <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Revenue</th>
                          <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Deposits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueStats.monthlyRevenue?.map((m) => (
                          <tr key={m.month} className="border-b border-border/50">
                            <td className="px-4 py-2 font-medium text-text-bright text-sm">{m.month}</td>
                            <td className="px-4 py-2 text-right font-mono text-success">{formatUsd(m.totalRevenue)}</td>
                            <td className="px-4 py-2 text-right font-mono text-text-muted">{m.depositCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'keys' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
                <Key className="w-3.5 h-3.5" />
                <span>{apiKeys.length} API keys</span>
              </div>
              <button type="button"
                onClick={() => exportCSV(apiKeys, 'api-keys')}
                className="flex items-center gap-2 px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text text-sm font-mono transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>

            <div className="rounded border border-border bg-surface overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-panel">
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Key</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">User</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Name</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Status</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Requests</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Total Spend</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Created</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="border-b border-border/50 hover:bg-surface/50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-accent">{key.keyPrefix}***</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-text-secondary">{formatAddress(key.userAddress)}</span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-sm">{key.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                          key.active ? 'bg-success-dim text-success' : 'bg-surface text-text-muted'
                        }`}>
                          {key.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-text-muted">{key.totalRequests.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber">{formatUsd(key.totalSpend)}</td>
                      <td className="px-4 py-3 text-text-muted font-mono text-xs">{formatDateShort(key.createdAt)}</td>
                      <td className="px-4 py-3 text-text-muted font-mono text-xs">{key.lastUsedAt ? formatDateShort(key.lastUsedAt) : 'Never'}</td>
                    </tr>
                  ))}
                  {apiKeys.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-text-muted font-mono">No API keys found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        )}

        {activeTab === 'fees' && (
          <div className="rounded border border-border bg-surface p-8 text-center">
            <DollarSign className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-muted font-mono">Fee configuration</p>
            <Link href="/admin/fees" className="text-accent hover:underline mt-2 inline-block font-mono text-sm">Open Fee Configuration →</Link>
          </div>
        )}

        {activeTab === 'rate-limits' && (
          <div className="rounded border border-border bg-surface p-8 text-center">
            <Gauge className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-muted font-mono">Rate limit configuration</p>
            <Link href="/admin/rate-limits" className="text-accent hover:underline mt-2 inline-block font-mono text-sm">Open Rate Limits →</Link>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
          <h2 className="font-mono text-text text-lg">Admin Panel Error</h2>
          <p className="text-sm text-text-muted max-w-md font-mono">An unexpected error occurred in the admin panel.</p>
          <button type="button"
            onClick={() => window.location.reload()}
            className="btn-primary flex items-center gap-2"
          >
            ↻ Retry
          </button>
        </div>
      }
    >
      {content}
    </ErrorBoundary>
  )
}
