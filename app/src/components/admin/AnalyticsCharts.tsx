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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-3.5 h-3.5 text-[var(--color-cyan)]" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Usage Over Time</h3>
          </div>
          <div className="h-[260px]">
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
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => format(new Date(value), 'MMM d')}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    fontSize: '11px',
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

        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-3.5 h-3.5 text-[var(--color-amber)]" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Cost Breakdown</h3>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={costBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
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
                    borderRadius: '6px',
                    fontSize: '11px',
                  }}
                  formatter={(value: unknown) => [formatCurrency(value as number), 'Cost']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {costBreakdownData.slice(0, 4).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[var(--color-text-muted)] font-mono truncate">{item.name}</span>
                </div>
                <span className="text-[var(--color-text-bright)] font-mono">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-3.5 h-3.5 text-[var(--color-violet)]" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Top Models (Requests)</h3>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topModelsData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#71717a"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#71717a"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    fontSize: '11px',
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

        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-3.5 h-3.5 text-[var(--color-success)]" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Provider Distribution</h3>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={providerData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#71717a"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '6px',
                    fontSize: '11px',
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
        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-3.5 h-3.5 text-[var(--color-cyan)]" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Provider Health</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {analytics.providerHealth.map((provider) => (
              <div
                key={provider.provider}
                className={`rounded p-3 ${
                  provider.isUp ? 'border border-[var(--color-success)]/20 bg-[var(--color-success-dim)]' : 'border border-[var(--color-error)]/20 bg-[var(--color-error)]/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[var(--color-text-bright)] capitalize">{provider.provider}</span>
                  <div className={`w-2 h-2 rounded-full ${provider.isUp ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]'}`} />
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] font-mono space-y-1">
                  <p>Latency: {provider.latencyMs ? `${provider.latencyMs}ms` : 'N/A'}</p>
                  <p>Error Rate: {provider.errorRate ? `${(provider.errorRate * 100).toFixed(1)}%` : '0%'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">Token Usage Summary</h3>
        </div>
        <div className="grid grid-cols-3 divide-x divide-[var(--color-border)]/50">
          <div className="px-4 py-4 text-center">
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-1">Input Tokens</p>
            <p className="text-xl font-bold font-mono text-[var(--color-cyan)]">{formatNumber(analytics.summary.totalInputTokens)}</p>
          </div>
          <div className="px-4 py-4 text-center">
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-1">Output Tokens</p>
            <p className="text-xl font-bold font-mono text-[var(--color-amber)]">{formatNumber(analytics.summary.totalOutputTokens)}</p>
          </div>
          <div className="px-4 py-4 text-center">
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider mb-1">Total Cost</p>
            <p className="text-xl font-bold font-mono text-[var(--color-text-bright)]">{formatCurrency(analytics.summary.totalCost)}</p>
          </div>
        </div>
      </div>
    </>
  )
}