'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Users, CreditCard, DollarSign, Key, TrendingUp, Activity, RefreshCw, Download, Eye, Zap, Clock, Gauge, Terminal } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'

const AdminOverviewCharts = dynamic(() => import('@/components/admin/AdminOverviewCharts').then(m => ({ default: m.AdminOverviewCharts })), { ssr: false })
const AdminRevenueChart = dynamic(() => import('@/components/admin/AdminRevenueCharts').then(m => ({ default: m.AdminRevenueCharts })), { ssr: false })

type Tab = 'overview' | 'users' | 'usage' | 'revenue' | 'keys' | 'fees' | 'rate-limits'

type User = {
  id: string
  address: string
  solanaAddress: string | null
  accountNumber: string | null
  createdAt: string
  lastActivityAt: string | null
  balanceDollars: number
  totalDeposited: number
  totalUsed: number
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
}

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
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [usagePeriod, setUsagePeriod] = useState('30d')
  const [revenuePeriod, setRevenuePeriod] = useState('30d')

  const fetchUsers = async (page: number) => {
    setUsersLoading(true)
    try {
      const res = await fetch(`/api/admin/users?page=${page}&limit=50`)
      const data = await res.json()
      setUsers(data?.users || [])
      setUsersPage(data?.pagination?.page || 1)
      setUsersTotal(data?.pagination?.total || 0)
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
    setUsersLoading(false)
  }

  const fetchStats = async () => {
    try {
      const [usersRes, keysRes, usageRes, revenueRes] = await Promise.all([
        fetch('/api/admin/users?page=1&limit=1'),
        fetch('/api/admin/keys?limit=1'),
        fetch('/api/admin/usage?period=30d'),
        fetch('/api/admin/revenue?period=30d'),
      ])
      
      if (!usersRes.ok || !keysRes.ok || !usageRes.ok || !revenueRes.ok) {
        throw new Error('Failed to fetch stats')
      }
      
      const [usersData, keysData, usageData, revenueData] = await Promise.all([
        usersRes.json(),
        keysRes.json(),
        usageRes.json(),
        revenueRes.json(),
      ])
      
      if (!usersData || !keysData || !usageData || !revenueData) {
        throw new Error('Invalid response data')
      }
      
      const now = new Date()
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const activeUsersLast24h = usersData.users?.filter((u: User) => 
        u.lastActivityAt && new Date(u.lastActivityAt) > last24h
      ).length || 0

      setAdminStats({
        totalUsers: usersData?.pagination?.total || 0,
        totalApiKeys: keysData?.pagination?.total || 0,
        totalDollarsPurchased: revenueData?.summary?.totalDeposits || 0,
        totalUsageThisMonth: usageData?.summary?.totalRevenue || 0,
        revenue: (revenueData?.summary?.totalRevenue || 0) - (revenueData?.summary?.totalCost || 0),
        activeUsersLast24h,
        providerCosts: {
          venice: usageData?.byProvider?.find((p: { provider: string }) => p.provider === 'venice')?.totalCost || 0,
          openrouter: usageData?.byProvider?.find((p: { provider: string }) => p.provider === 'openrouter')?.totalCost || 0,
        },
      })
      
      setUsageStats(usageData || null)
      setRevenueStats(revenueData || null)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
      setAdminStats(null)
      setUsageStats(null)
      setRevenueStats(null)
    }
  }

  const fetchApiKeys = async () => {
    try {
      const res = await fetch('/api/admin/keys?limit=100')
      const data = await res.json()
      setApiKeys(data.keys)
    } catch (err) {
      console.error('Failed to fetch API keys:', err)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchUsers(1)
  }, [])

  useEffect(() => {
    if (activeTab === 'keys') fetchApiKeys()
  }, [activeTab])

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users
    const q = searchQuery.toLowerCase()
    return users.filter(u => 
      u.address.toLowerCase().includes(q) ||
      u.solanaAddress?.toLowerCase().includes(q) ||
      u.accountNumber?.toLowerCase().includes(q)
    )
  }, [users, searchQuery])

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`
  
  const formatAddress = (addr: string) => {
    if (addr.length > 16) return `${addr.slice(0, 8)}...${addr.slice(-6)}`
    return addr
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const exportCSV = (data: unknown[], filename: string) => {
    if (!data || !data.length) return
    const headers = Object.keys(data[0] as object)
    const csv = [headers.join(','), ...data.map(row => headers.map(h => JSON.stringify((row as Record<string, unknown>)[h] ?? '')).join(','))]
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
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

  return (
    <div className="min-h-screen bg-[var(--color-void)] text-[var(--color-text)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-[95rem] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded border border-[var(--color-accent)] bg-[var(--color-accent-dim)] flex items-center justify-center">
                <Terminal className="w-4 h-4 text-[var(--color-cyan)]" />
              </div>
              <div>
                <h1 className="text-lg font-bold font-syne tracking-tight text-[var(--color-text-bright)]">OMA Admin</h1>
                <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-widest">Gateway Operations</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                <span className="text-[11px] font-mono text-[var(--color-text-muted)]">LIVE</span>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchStats}
                className="flex items-center gap-2 px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-bright)] transition-colors text-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--color-border)]">
        <div className="max-w-[95rem] mx-auto px-4">
          <div className="flex gap-0.5 overflow-x-auto scrollbar-none">
            {(['overview', 'users', 'usage', 'revenue', 'keys', 'fees', 'rate-limits'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-xs font-medium font-mono uppercase tracking-wider transition-all border-b-2 whitespace-nowrap rounded-full ${
                  activeTab === tab
                    ? 'text-[var(--color-cyan)] border-[var(--color-cyan)] bg-[var(--color-accent-dim)]/30'
                    : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
                }`}
              >
                {tab === 'overview' && <Activity className="w-3.5 h-3.5 inline mr-1.5" />}
                {tab === 'users' && <Users className="w-3.5 h-3.5 inline mr-1.5" />}
                {tab === 'usage' && <TrendingUp className="w-3.5 h-3.5 inline mr-1.5" />}
                {tab === 'revenue' && <DollarSign className="w-3.5 h-3.5 inline mr-1.5" />}
                {tab === 'keys' && <Key className="w-3.5 h-3.5 inline mr-1.5" />}
                {tab === 'fees' && <DollarSign className="w-3.5 h-3.5 inline mr-1.5" />}
                {tab === 'rate-limits' && <Gauge className="w-3.5 h-3.5 inline mr-1.5" />}
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[95rem] mx-auto px-4 py-6">
        {activeTab === 'overview' && !adminStats && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 flex items-center justify-center mb-6">
              <Activity className="w-8 h-8 text-[var(--color-accent)]" />
            </div>
            <h2 className="text-xl font-bold font-mono text-[var(--color-text-bright)] mb-2">No Data Available</h2>
            <p className="text-sm text-[var(--color-text-muted)] font-mono max-w-md text-center mb-6">
              Admin statistics will appear here once there is user activity on the gateway. Connect your database and start the server to begin tracking.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchStats}
                className="flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors text-sm font-mono"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Fetch
              </button>
              <a
                href="/admin/fees"
                className="flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-bright)] transition-colors text-sm font-mono"
              >
                Configure Fees
              </a>
            </div>
          </div>
        )}

        {activeTab === 'overview' && adminStats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 group hover:border-[var(--color-accent)]/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Total Users</span>
                </div>
                <p className="text-2xl font-bold font-mono text-[var(--color-text-bright)]">{adminStats.totalUsers.toLocaleString()}</p>
              </div>
              <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 group hover:border-[var(--color-accent)]/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <Key className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">API Keys</span>
                </div>
                <p className="text-2xl font-bold font-mono text-[var(--color-text-bright)]">{adminStats.totalApiKeys.toLocaleString()}</p>
              </div>
              <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 group hover:border-[var(--color-accent)]/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Credits Purchased</span>
                </div>
                <p className="text-2xl font-bold font-mono text-[var(--color-success)]">{formatCurrency(adminStats.totalDollarsPurchased)}</p>
              </div>
              <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 group hover:border-[var(--color-accent)]/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Usage This Month</span>
                </div>
                <p className="text-2xl font-bold font-mono text-[var(--color-amber)]">{formatCurrency(adminStats.totalUsageThisMonth)}</p>
              </div>
              <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 group hover:border-[var(--color-accent)]/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Revenue</span>
                </div>
                <p className="text-2xl font-bold font-mono text-[var(--color-cyan)]">{formatCurrency(adminStats.revenue)}</p>
              </div>
              <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4 group hover:border-[var(--color-accent)]/30 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Active (24h)</span>
                </div>
                <p className="text-2xl font-bold font-mono text-[var(--color-text-bright)]">{adminStats.activeUsersLast24h}</p>
              </div>
            </div>

            <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Provider Costs // This Month</h3>
                <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded border border-[var(--color-border)] bg-[var(--color-panel)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded border border-[var(--color-blue)]/30 bg-[var(--color-blue)]/10 flex items-center justify-center">
                      <span className="text-[11px] font-bold font-mono text-[var(--color-blue)]">V</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-bright)]">Venice</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Primary provider</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold font-mono text-[var(--color-amber)]">{formatCurrency(adminStats.providerCosts.venice)}</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded border border-[var(--color-border)] bg-[var(--color-panel)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded border border-[var(--color-violet)]/30 bg-[var(--color-violet)]/10 flex items-center justify-center">
                      <span className="text-[11px] font-bold font-mono text-[var(--color-violet)]">OR</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-bright)]">OpenRouter</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">Backup provider</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold font-mono text-[var(--color-amber)]">{formatCurrency(adminStats.providerCosts.openrouter)}</p>
                </div>
                <div className="border-t border-[var(--color-border)] pt-3 flex items-center justify-between">
                  <p className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Total Provider Costs</p>
                  <p className="text-lg font-bold font-mono text-[var(--color-text-bright)]">
                    {formatCurrency(adminStats.providerCosts.venice + adminStats.providerCosts.openrouter)}
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Search by address, solana address, or account number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]/50"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] font-mono">
                <span>{usersTotal} total users</span>
              </div>
            </div>

            <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider">Address</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider text-right">Balance</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider text-right">Total Deposited</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider text-right">Total Used</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider text-right">Requests</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider">Last Active</th>
                    <th className="px-4 py-3 font-medium text-[var(--color-text-muted)] text-xs font-mono uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface)]/50">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm text-[var(--color-text-secondary)]">{formatAddress(user.address)}</div>
                        {user.solanaAddress && (
                          <div className="text-[11px] text-[var(--color-text-muted)] font-mono">{formatAddress(user.solanaAddress)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-cyan)]">{formatCurrency(user.balanceDollars)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-success)]">{formatCurrency(user.totalDeposited)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-amber)]">{formatCurrency(user.totalUsed)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-text-muted)]">{user.totalRequests?.toLocaleString() || 0}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] font-mono text-xs">{user.lastActivityAt ? formatDate(user.lastActivityAt) : 'Never'}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="p-1.5 rounded hover:bg-[var(--color-panel)] text-[var(--color-text-muted)] hover:text-[var(--color-cyan)] transition-colors inline-flex"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && !usersLoading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)] font-mono">No users found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => fetchUsers(usersPage - 1)}
                disabled={usersPage <= 1}
                className="px-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-bright)] disabled:opacity-30 disabled:cursor-not-allowed disabled:border-[var(--color-border)]/50 disabled:text-[var(--color-text-muted)] text-sm font-mono transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">Page {usersPage} of {Math.ceil(usersTotal / 50) || 1}</span>
              <button
                onClick={() => fetchUsers(usersPage + 1)}
                disabled={usersPage >= Math.ceil(usersTotal / 50)}
                className="px-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-[var(--color-border-bright)] disabled:opacity-30 disabled:cursor-not-allowed disabled:border-[var(--color-border)]/50 disabled:text-[var(--color-text-muted)] text-sm font-mono transition-colors"
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
                <span className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Period:</span>
                {['7d', '30d', '90d'].map((p) => (
                  <button
                    key={p}
                    onClick={() => { setUsagePeriod(p); fetchStats() }}
                    className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                      usagePeriod === p ? 'bg-[var(--color-accent-dim)] text-[var(--color-cyan)] border border-[var(--color-accent)]/30' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {usageStats && (
                <button
                  onClick={() => exportCSV(usageStats.dailyUsage, `usage-${usagePeriod}`)}
                  className="flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-sm font-mono transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              )}
            </div>

            {usageStats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">Total Requests</p>
                    <p className="text-2xl font-bold font-mono text-[var(--color-text-bright)]">{usageStats.summary.totalRequests.toLocaleString()}</p>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">Total Revenue</p>
                    <p className="text-2xl font-bold font-mono text-[var(--color-success)]">{formatCurrency(usageStats.summary.totalRevenue)}</p>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">Total Cost</p>
                    <p className="text-2xl font-bold font-mono text-[var(--color-amber)]">{formatCurrency(usageStats.summary.totalCost)}</p>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">Gross Profit</p>
                    <p className="text-2xl font-bold font-mono text-[var(--color-cyan)]">{formatCurrency(usageStats.summary.grossProfit)}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-1">Margin: {usageStats.summary.margin}</p>
                  </div>
                </div>

                <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">By Provider</h3>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/50">
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Provider</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">Requests</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">Revenue</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">Cost</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageStats.byProvider.map((p) => (
                        <tr key={p.provider} className="border-b border-[var(--color-border)]/50">
                          <td className="px-4 py-2 font-medium text-[var(--color-text-bright)] capitalize text-sm">{p.provider}</td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--color-text-muted)]">{p.totalRequests.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--color-success)]">{formatCurrency(p.totalRevenue)}</td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--color-amber)]">{formatCurrency(p.totalCost)}</td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--color-cyan)]">{formatCurrency(p.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
                    <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Top Models</h3>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/50">
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Model</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">Requests</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">Input Tokens</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">Output Tokens</th>
                        <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageStats.byModel.map((m) => (
                        <tr key={m.model} className="border-b border-[var(--color-border)]/50">
                          <td className="px-4 py-2">
                            <div className="font-mono text-sm text-[var(--color-text-bright)]">{m.model}</div>
                            <div className="text-[10px] text-[var(--color-text-muted)] capitalize">{m.provider}</div>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--color-text-muted)]">{m.totalRequests.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--color-text-muted)]">{m.totalInputTokens.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--color-text-muted)]">{m.totalOutputTokens.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--color-success)]">{formatCurrency(m.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <span className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Period:</span>
              {['7d', '30d', '90d', 'all'].map((p) => (
                <button
                  key={p}
                  onClick={() => { setRevenuePeriod(p); fetchStats() }}
                  className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                    revenuePeriod === p ? 'bg-[var(--color-accent-dim)] text-[var(--color-cyan)] border border-[var(--color-accent)]/30' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-text)]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {revenueStats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">Total Revenue</p>
                    <p className="text-2xl font-bold font-mono text-[var(--color-success)]">{formatCurrency(revenueStats.summary.totalRevenue)}</p>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">Total Deposits</p>
                    <p className="text-2xl font-bold font-mono text-[var(--color-text-bright)]">{formatCurrency(revenueStats.summary.totalDeposits)}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-1">{revenueStats.summary.depositCount} transactions</p>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">Gross Profit</p>
                    <p className="text-2xl font-bold font-mono text-[var(--color-cyan)]">{formatCurrency(revenueStats.summary.grossProfit)}</p>
                  </div>
                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-2">New Users</p>
                    <p className="text-2xl font-bold font-mono text-[var(--color-text-bright)]">{revenueStats.summary.newUsers.toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AdminRevenueChart monthlyRevenue={revenueStats?.monthlyRevenue} />

                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-panel)] flex items-center justify-between">
                      <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Monthly Breakdown</h3>
                      <button
                        onClick={() => exportCSV(revenueStats.monthlyRevenue, `revenue-${revenuePeriod}`)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-[11px] font-mono"
                      >
                        <Download className="w-3 h-3" /> Export
                      </button>
                    </div>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/50">
                          <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Month</th>
                          <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">Revenue</th>
                          <th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">Deposits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueStats.monthlyRevenue?.map((m) => (
                          <tr key={m.month} className="border-b border-[var(--color-border)]/50">
                            <td className="px-4 py-2 font-medium text-[var(--color-text-bright)] text-sm">{m.month}</td>
                            <td className="px-4 py-2 text-right font-mono text-[var(--color-success)]">{formatCurrency(m.totalRevenue)}</td>
                            <td className="px-4 py-2 text-right font-mono text-[var(--color-text-muted)]">{m.depositCount}</td>
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
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] font-mono">
                <Key className="w-3.5 h-3.5" />
                <span>{apiKeys.length} API keys</span>
              </div>
              <button
                onClick={() => exportCSV(apiKeys, 'api-keys')}
                className="flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-sm font-mono transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>

            <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-panel)]">
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Key</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">User</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Name</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Status</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">Requests</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] text-right">Total Spend</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Created</th>
                    <th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface)]/50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-[var(--color-cyan)]">{key.keyPrefix}***</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-[var(--color-text-secondary)]">{formatAddress(key.userAddress)}</span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] text-sm">{key.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                          key.active ? 'bg-[var(--color-success-dim)] text-[var(--color-success)]' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                        }`}>
                          {key.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-text-muted)]">{key.totalRequests.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--color-amber)]">{formatCurrency(key.totalSpend)}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] font-mono text-xs">{formatDate(key.createdAt)}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] font-mono text-xs">{key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}</td>
                    </tr>
                  ))}
                  {apiKeys.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-[var(--color-text-muted)] font-mono">No API keys found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'fees' && (
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
            <DollarSign className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
            <p className="text-[var(--color-text-muted)] font-mono">Fee configuration</p>
            <a href="/admin/fees" className="text-[var(--color-cyan)] hover:underline mt-2 inline-block font-mono text-sm">Open Fee Configuration →</a>
          </div>
        )}

        {activeTab === 'rate-limits' && (
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
            <Gauge className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
            <p className="text-[var(--color-text-muted)] font-mono">Rate limit configuration</p>
            <a href="/admin/rate-limits" className="text-[var(--color-cyan)] hover:underline mt-2 inline-block font-mono text-sm">Open Rate Limits →</a>
          </div>
        )}
      </div>
    </div>
  )
}