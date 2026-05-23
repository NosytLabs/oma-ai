'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Users, CreditCard, DollarSign, Key, TrendingUp, Activity, RefreshCw, Download, Eye, Zap, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import Link from 'next/link'
import { format } from 'date-fns'

type Tab = 'overview' | 'users' | 'usage' | 'revenue' | 'keys'

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
      setUsers(data.users)
      setUsersPage(data.pagination.page)
      setUsersTotal(data.pagination.total)
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
      const [usersData, keysData, usageData, revenueData] = await Promise.all([
        usersRes.json(),
        keysRes.json(),
        usageRes.json(),
        revenueRes.json(),
      ])
      
      const now = new Date()
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const activeUsersLast24h = usersData.users?.filter((u: User) => 
        u.lastActivityAt && new Date(u.lastActivityAt) > last24h
      ).length || 0

      setAdminStats({
        totalUsers: usersData.pagination?.total || 0,
        totalApiKeys: keysData.pagination?.total || 0,
        totalDollarsPurchased: revenueData.summary?.totalDeposits || 0,
        totalUsageThisMonth: usageData.summary?.totalRevenue || 0,
        revenue: (revenueData.summary?.totalRevenue || 0) - (revenueData.summary?.totalCost || 0),
        activeUsersLast24h,
        providerCosts: {
          venice: usageData.byProvider?.find((p: { provider: string }) => p.provider === 'venice')?.totalCost || 0,
          openrouter: usageData.byProvider?.find((p: { provider: string }) => p.provider === 'openrouter')?.totalCost || 0,
        },
      })
      
      setUsageStats(usageData)
      setRevenueStats(revenueData)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
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
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display">OMA Admin</h1>
                <p className="text-xs text-zinc-500">Gateway Operations Dashboard</p>
              </div>
            </div>
            <button
              onClick={fetchStats}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {(['overview', 'users', 'usage', 'revenue', 'keys'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                {tab === 'overview' && <Activity className="w-4 h-4 inline mr-2" />}
                {tab === 'users' && <Users className="w-4 h-4 inline mr-2" />}
                {tab === 'usage' && <TrendingUp className="w-4 h-4 inline mr-2" />}
                {tab === 'revenue' && <DollarSign className="w-4 h-4 inline mr-2" />}
                {tab === 'keys' && <Key className="w-4 h-4 inline mr-2" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'overview' && adminStats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-500">Total Users</span>
                </div>
                <p className="text-2xl font-bold text-white">{adminStats.totalUsers.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-500">Total API Keys</span>
                </div>
                <p className="text-2xl font-bold text-white">{adminStats.totalApiKeys.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-500">Credits Purchased</span>
                </div>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(adminStats.totalDollarsPurchased)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-500">Usage This Month</span>
                </div>
                <p className="text-2xl font-bold text-amber-400">{formatCurrency(adminStats.totalUsageThisMonth)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-500">Revenue</span>
                </div>
                <p className="text-2xl font-bold text-cyan-400">{formatCurrency(adminStats.revenue)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span className="text-xs text-zinc-500">Active (24h)</span>
                </div>
                <p className="text-2xl font-bold text-white">{adminStats.activeUsersLast24h}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <h3 className="text-sm font-medium text-white mb-4">Revenue Overview</h3>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.slice(-30)}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#71717a" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => {
                          const d = new Date(value)
                          return format(d, 'MMM d')
                        }}
                      />
                      <YAxis 
                        stroke="#71717a" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#18181b', 
                          border: '1px solid #3f3f46',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        formatter={(value) => [`${Number(value).toFixed(2)}`, 'Revenue']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#22d3ee" 
                        fill="url(#revenueGradient)" 
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <h3 className="text-sm font-medium text-white mb-4">Provider Costs (This Month)</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-400">V</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">Venice</p>
                        <p className="text-xs text-zinc-500">Primary provider</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-amber-400">{formatCurrency(adminStats.providerCosts.venice)}</p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-purple-400">OR</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">OpenRouter</p>
                        <p className="text-xs text-zinc-500">Backup provider</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-amber-400">{formatCurrency(adminStats.providerCosts.openrouter)}</p>
                  </div>
                  <div className="border-t border-zinc-800 pt-4 flex items-center justify-between">
                    <p className="text-sm text-zinc-400">Total Provider Costs</p>
                    <p className="text-lg font-bold text-white">
                      {formatCurrency(adminStats.providerCosts.venice + adminStats.providerCosts.openrouter)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                <h3 className="font-medium text-white">Recent Transactions</h3>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {usageStats?.dailyUsage?.slice(-10).reverse().map((day, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{format(new Date(day.date), 'MMM d, yyyy')}</p>
                      <p className="text-xs text-zinc-500">{day.totalRequests.toLocaleString()} requests</p>
                    </div>
                    <p className="text-sm font-mono text-cyan-400">{formatCurrency(day.totalRevenue)}</p>
                  </div>
                )) || (
                  <div className="px-4 py-8 text-center text-zinc-500">No transactions yet</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by address, solana address, or account number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <span>{usersTotal} total users</span>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-4 py-3 font-medium text-zinc-400">Address</th>
                    <th className="px-4 py-3 font-medium text-zinc-400 text-right">Balance</th>
                    <th className="px-4 py-3 font-medium text-zinc-400 text-right">Total Deposited</th>
                    <th className="px-4 py-3 font-medium text-zinc-400 text-right">Total Used</th>
                    <th className="px-4 py-3 font-medium text-zinc-400 text-right">Requests</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Last Active</th>
                    <th className="px-4 py-3 font-medium text-zinc-400"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm text-zinc-300">{formatAddress(user.address)}</div>
                        {user.solanaAddress && (
                          <div className="text-xs text-zinc-600">{formatAddress(user.solanaAddress)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-cyan-400">{formatCurrency(user.balanceDollars)}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-400">{formatCurrency(user.totalDeposited)}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-400">{formatCurrency(user.totalUsed)}</td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">{user.totalRequests?.toLocaleString() || 0}</td>
                      <td className="px-4 py-3 text-zinc-500">{user.lastActivityAt ? formatDate(user.lastActivityAt) : 'Never'}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors inline-flex"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && !usersLoading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">No users found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => fetchUsers(usersPage - 1)}
                disabled={usersPage <= 1}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-500">Page {usersPage} of {Math.ceil(usersTotal / 50) || 1}</span>
              <button
                onClick={() => fetchUsers(usersPage + 1)}
                disabled={usersPage >= Math.ceil(usersTotal / 50)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <span className="text-sm text-zinc-400">Period:</span>
                {['7d', '30d', '90d'].map((p) => (
                  <button
                    key={p}
                    onClick={() => { setUsagePeriod(p); fetchStats() }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      usagePeriod === p ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {usageStats && (
                <button
                  onClick={() => exportCSV(usageStats.dailyUsage, `usage-${usagePeriod}`)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              )}
            </div>

            {usageStats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                    <p className="text-sm text-zinc-500 mb-1">Total Requests</p>
                    <p className="text-2xl font-bold text-white">{usageStats.summary.totalRequests.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                    <p className="text-sm text-zinc-500 mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-emerald-400">{formatCurrency(usageStats.summary.totalRevenue)}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                    <p className="text-sm text-zinc-500 mb-1">Total Cost</p>
                    <p className="text-2xl font-bold text-amber-400">{formatCurrency(usageStats.summary.totalCost)}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                    <p className="text-sm text-zinc-500 mb-1">Gross Profit</p>
                    <p className="text-2xl font-bold text-cyan-400">{formatCurrency(usageStats.summary.grossProfit)}</p>
                    <p className="text-xs text-zinc-500 mt-1">Margin: {usageStats.summary.margin}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                    <h3 className="font-medium text-white">By Provider</h3>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/30">
                        <th className="px-4 py-2 font-medium text-zinc-400">Provider</th>
                        <th className="px-4 py-2 font-medium text-zinc-400 text-right">Requests</th>
                        <th className="px-4 py-2 font-medium text-zinc-400 text-right">Revenue</th>
                        <th className="px-4 py-2 font-medium text-zinc-400 text-right">Cost</th>
                        <th className="px-4 py-2 font-medium text-zinc-400 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageStats.byProvider.map((p) => (
                        <tr key={p.provider} className="border-b border-zinc-800/50">
                          <td className="px-4 py-2 font-medium text-white capitalize">{p.provider}</td>
                          <td className="px-4 py-2 text-right font-mono text-zinc-400">{p.totalRequests.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-emerald-400">{formatCurrency(p.totalRevenue)}</td>
                          <td className="px-4 py-2 text-right font-mono text-amber-400">{formatCurrency(p.totalCost)}</td>
                          <td className="px-4 py-2 text-right font-mono text-cyan-400">{formatCurrency(p.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                    <h3 className="font-medium text-white">Top Models</h3>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/30">
                        <th className="px-4 py-2 font-medium text-zinc-400">Model</th>
                        <th className="px-4 py-2 font-medium text-zinc-400 text-right">Requests</th>
                        <th className="px-4 py-2 font-medium text-zinc-400 text-right">Input Tokens</th>
                        <th className="px-4 py-2 font-medium text-zinc-400 text-right">Output Tokens</th>
                        <th className="px-4 py-2 font-medium text-zinc-400 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageStats.byModel.map((m) => (
                        <tr key={m.model} className="border-b border-zinc-800/50">
                          <td className="px-4 py-2">
                            <div className="font-mono text-sm text-white">{m.model}</div>
                            <div className="text-xs text-zinc-500 capitalize">{m.provider}</div>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-zinc-400">{m.totalRequests.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-zinc-400">{m.totalInputTokens.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-zinc-400">{m.totalOutputTokens.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-mono text-emerald-400">{formatCurrency(m.totalRevenue)}</td>
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
              <span className="text-sm text-zinc-400">Period:</span>
              {['7d', '30d', '90d', 'all'].map((p) => (
                <button
                  key={p}
                  onClick={() => { setRevenuePeriod(p); fetchStats() }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    revenuePeriod === p ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {revenueStats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                    <p className="text-sm text-zinc-500 mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-emerald-400">{formatCurrency(revenueStats.summary.totalRevenue)}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                    <p className="text-sm text-zinc-500 mb-1">Total Deposits</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(revenueStats.summary.totalDeposits)}</p>
                    <p className="text-xs text-zinc-500 mt-1">{revenueStats.summary.depositCount} transactions</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                    <p className="text-sm text-zinc-500 mb-1">Gross Profit</p>
                    <p className="text-2xl font-bold text-cyan-400">{formatCurrency(revenueStats.summary.grossProfit)}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                    <p className="text-sm text-zinc-500 mb-1">New Users</p>
                    <p className="text-2xl font-bold text-white">{revenueStats.summary.newUsers.toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                    <h3 className="text-sm font-medium text-white mb-4">Revenue Chart</h3>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueStats.monthlyRevenue?.slice(-12)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                          <XAxis 
                            dataKey="month" 
                            stroke="#71717a" 
                            fontSize={11} 
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            stroke="#71717a" 
                            fontSize={11} 
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `$${value}`}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#18181b', 
                              border: '1px solid #3f3f46',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                            formatter={(value) => [`${Number(value).toFixed(2)}`, 'Revenue']}
                          />
                          <Bar dataKey="totalRevenue" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 overflow-hidden">
                    <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
                      <h3 className="font-medium text-white">Monthly Breakdown</h3>
                      <button
                        onClick={() => exportCSV(revenueStats.monthlyRevenue, `revenue-${revenuePeriod}`)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm"
                      >
                        <Download className="w-4 h-4" /> Export
                      </button>
                    </div>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/30">
                          <th className="px-4 py-2 font-medium text-zinc-400">Month</th>
                          <th className="px-4 py-2 font-medium text-zinc-400 text-right">Revenue</th>
                          <th className="px-4 py-2 font-medium text-zinc-400 text-right">Deposits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueStats.monthlyRevenue?.map((m) => (
                          <tr key={m.month} className="border-b border-zinc-800/50">
                            <td className="px-4 py-2 font-medium text-white">{m.month}</td>
                            <td className="px-4 py-2 text-right font-mono text-emerald-400">{formatCurrency(m.totalRevenue)}</td>
                            <td className="px-4 py-2 text-right font-mono text-zinc-400">{m.depositCount}</td>
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
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Key className="w-4 h-4" />
                <span>{apiKeys.length} API keys</span>
              </div>
              <button
                onClick={() => exportCSV(apiKeys, 'api-keys')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>

            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-4 py-3 font-medium text-zinc-400">Key</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">User</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Name</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Status</th>
                    <th className="px-4 py-3 font-medium text-zinc-400 text-right">Requests</th>
                    <th className="px-4 py-3 font-medium text-zinc-400 text-right">Total Spend</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Created</th>
                    <th className="px-4 py-3 font-medium text-zinc-400">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-cyan-400">{key.keyPrefix}***</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-zinc-300">{formatAddress(key.userAddress)}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{key.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          key.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'
                        }`}>
                          {key.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">{key.totalRequests.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-400">{formatCurrency(key.totalSpend)}</td>
                      <td className="px-4 py-3 text-zinc-500">{formatDate(key.createdAt)}</td>
                      <td className="px-4 py-3 text-zinc-500">{key.lastUsedAt ? formatDate(key.lastUsedAt) : 'Never'}</td>
                    </tr>
                  ))}
                  {apiKeys.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">No API keys found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}