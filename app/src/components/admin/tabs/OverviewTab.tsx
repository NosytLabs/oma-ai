'use client'

import { Users, Key, CreditCard, Zap, TrendingUp, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'
import { formatUsd } from '@/lib/utils'

import { StatCard } from './StatCard'

const PROVIDER_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  venice: {
    text: 'text-[var(--color-provider-venice)]',
    border: 'border-[var(--color-provider-venice)]/30',
    bg: 'bg-[var(--color-provider-venice)]/10',
  },
}

const AdminOverviewCharts = dynamic(() => import('@/components/admin/AdminOverviewCharts').then(m => ({ default: m.AdminOverviewCharts })), { ssr: false })

type AdminStats = {
  totalUsers: number
  totalApiKeys: number
  totalDollarsPurchased: number
  totalUsageThisMonth: number
  revenue: number
  activeUsersLast24h: number
  providerCosts: {
    venice: number
    total: number
  }
}

type UsageStats = {
  period: string
  summary: { totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalRevenue: number; totalCost: number; grossProfit: number; margin: string }
  byProvider: Array<{ provider: string; totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalRevenue: number; totalCost: number; profit: number }>
  byModel: Array<{ model: string; provider: string; totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalRevenue: number }>
  dailyUsage: Array<{ date: string; totalRequests: number; totalRevenue: number }>
}

type OverviewTabProps = {
  adminStats: AdminStats | null
  usageStats: UsageStats | null
  chartData: Array<{ date: string; revenue: number; cost: number }>
  refreshStats: () => void
  isError?: boolean
}

export function OverviewTab({ adminStats, usageStats, chartData, refreshStats, isError }: OverviewTabProps) {
  if (isError && !adminStats) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-12 h-12 rounded-xl border border-error/30 bg-error/5 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-error" aria-hidden="true" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-text-bright mb-1">Failed to load data</p>
          <p className="text-xs text-text-muted font-mono">An error occurred while fetching statistics.</p>
        </div>
        <button type="button"
          onClick={() => refreshStats()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface text-text-muted hover:text-text hover:border-border-bright transition-colors text-sm font-mono"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Retry
        </button>
      </div>
    )
  }

  if (!adminStats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded border border-border bg-surface p-4 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3.5 h-3.5 bg-border rounded" />
                <div className="h-3 w-16 bg-border rounded" />
              </div>
              <div className="h-7 w-20 bg-border rounded" />
            </div>
          ))}
        </div>
        <div className="rounded border border-border bg-surface p-5 animate-pulse">
          <div className="h-4 w-32 bg-border rounded mb-5" />
          <div className="space-y-3">
            <div className="h-14 bg-border rounded" />
            <div className="h-6 bg-border rounded" />
          </div>
        </div>
        <div className="rounded border border-border bg-surface p-5 animate-pulse">
          <div className="h-48 bg-border rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<Users className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />}
          label="Total Users"
          value={adminStats.totalUsers.toLocaleString()}
        />
        <StatCard
          icon={<Key className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />}
          label="API Keys"
          value={adminStats.totalApiKeys.toLocaleString()}
        />
        <StatCard
          icon={<CreditCard className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />}
          label="Credits Purchased"
          value={formatUsd(adminStats.totalDollarsPurchased)}
          valueClassName="text-success"
        />
        <StatCard
          icon={<Zap className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />}
          label="Usage This Month"
          value={formatUsd(adminStats.totalUsageThisMonth)}
          valueClassName="text-amber"
        />
        <StatCard
          icon={<TrendingUp className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />}
          label="Revenue"
          value={formatUsd(adminStats.revenue)}
          valueClassName="text-accent"
        />
        <StatCard
          icon={<Clock className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />}
          label="Active (24h)"
          value={String(adminStats.activeUsersLast24h)}
        />
      </div>

      <div className="rounded border border-border bg-surface p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">Provider Costs (This Month)</h3>
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded border border-border bg-panel">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded border ${PROVIDER_COLORS.venice.border} ${PROVIDER_COLORS.venice.bg} flex items-center justify-center`}>
                <span className={`text-[11px] font-bold font-mono ${PROVIDER_COLORS.venice.text}`}>V</span>
              </div>
              <div>
                <p className="text-sm font-medium text-text-bright">Venice</p>
                <p className="text-[10px] text-text-muted">Primary provider · private & uncensored</p>
              </div>
            </div>
            <p className="text-lg font-bold font-mono text-amber">{formatUsd(adminStats.providerCosts.venice)}</p>
          </div>
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <p className="text-xs text-text-muted font-mono uppercase tracking-wider">Total Provider Costs</p>
            <p className="text-lg font-bold font-mono text-text-bright">
              {formatUsd(adminStats.providerCosts.total)}
            </p>
          </div>
        </div>
      </div>

      <AdminOverviewCharts chartData={chartData} dailyUsage={usageStats?.dailyUsage} />
    </div>
  )
}
