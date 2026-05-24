'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { format } from 'date-fns'
import { Activity, Cpu, BarChart3, Clock } from 'lucide-react'

const CHART_COLORS = ['#00ffc8', '#ffb800', '#a78bfa', '#f472b6', '#34d399', '#60a5fa', '#f87171', '#c084fc']

interface ModelData {
  model: string
  provider: string
  totalRequests: number
  totalCost: number
}

interface DailyData {
  date: string
  totalRequests: number
  totalRevenue: number
  totalCost: number
}

interface ProviderData {
  provider: string
  totalRequests: number
  totalRevenue: number
}

interface ProviderHealth {
  provider: string
  isUp: boolean
  latencyMs: number
  errorRate: number
}

interface AnalyticsOverview {
  summary: {
    totalRequests: number
    totalInputTokens: number
    totalOutputTokens: number
    totalRevenue: number
    totalCost: number
    grossProfit: number
    margin: string
    uniqueUsers: number
    totalUsers: number
  }
  byProvider: ProviderData[]
  byModel: ModelData[]
  dailyUsage: DailyData[]
  providerHealth?: ProviderHealth[]
}

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`
const formatNumber = (num: number) => num.toLocaleString()

export function AnalyticsCharts({ analytics }: { analytics: AnalyticsOverview }) {
  const topModelsData = analytics.byModel.slice(0, 8).map((m, i) => ({
    name: m.model.length > 20 ? m.model.substring(0, 20) + '...' : m.model,
    fullName: m.model,
    requests: m.totalRequests,
    cost: m.totalCost,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))

  const providerData = analytics.byProvider.map((p, i) => ({
    name: p.provider,
    value: p.totalRequests,
    revenue: p.totalRevenue,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))

  const costBreakdownData = analytics.byModel.slice(0, 6).map((m, i) => ({
    name: m.model.length > 15 ? m.model.substring(0, 15) + '...' : m.model,
    value: Math.round(m.totalCost * 100) / 100,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }))

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-medium text-white">Usage Over Time</h3>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.dailyUsage}>
                <defs>
                  <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ffc8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00ffc8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: unknown, name: unknown) => [
                    name === 'totalRequests' ? formatNumber(value as number) : formatCurrency(value as number),
                    name === 'totalRequests' ? 'Requests' : 'Revenue'
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="totalRequests"
                  stroke="#00ffc8"
                  fill="url(#usageGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-medium text-white">Cost Breakdown</h3>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {costBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: unknown) => [formatCurrency(value as number), 'Cost']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {costBreakdownData.slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-zinc-400 truncate">{item.name}</span>
                </div>
                <span className="text-white font-mono">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-medium text-white">Top Models (Requests)</h3>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topModelsData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#71717a"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: unknown) => [formatNumber(value as number), 'Requests']}
                  labelFormatter={(label) => topModelsData.find(t => t.name === label)?.fullName || label}
                />
                <Bar dataKey="requests" radius={[0, 4, 4, 0]}>
                  {topModelsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-medium text-white">Provider Distribution</h3>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={providerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="name"
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
                  tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: unknown) => [
                    (value as number) >= 1000 ? formatNumber(value as number) : formatCurrency(value as number),
                    'Usage'
                  ]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {providerData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {analytics.providerHealth && analytics.providerHealth.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-medium text-white">Provider Health</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {analytics.providerHealth.map((provider) => (
              <div
                key={provider.provider}
                className={`rounded-lg p-3 ${
                  provider.isUp ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white capitalize">{provider.provider}</span>
                  <div className={`w-2 h-2 rounded-full ${provider.isUp ? 'bg-emerald-400' : 'bg-red-400'}`} />
                </div>
                <div className="text-xs text-zinc-500 space-y-1">
                  <p>Latency: {provider.latencyMs ? `${provider.latencyMs}ms` : 'N/A'}</p>
                  <p>Error Rate: {provider.errorRate ? `${(provider.errorRate * 100).toFixed(1)}%` : '0%'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <h3 className="font-medium text-white">Token Usage Summary</h3>
        </div>
        <div className="grid grid-cols-3 divide-x divide-zinc-800/50">
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-zinc-500 mb-1">Input Tokens</p>
            <p className="text-xl font-bold text-cyan-400">{formatNumber(analytics.summary.totalInputTokens)}</p>
          </div>
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-zinc-500 mb-1">Output Tokens</p>
            <p className="text-xl font-bold text-amber-400">{formatNumber(analytics.summary.totalOutputTokens)}</p>
          </div>
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-zinc-500 mb-1">Total Cost</p>
            <p className="text-xl font-bold text-white">{formatCurrency(analytics.summary.totalCost)}</p>
          </div>
        </div>
      </div>
    </>
  )
}
