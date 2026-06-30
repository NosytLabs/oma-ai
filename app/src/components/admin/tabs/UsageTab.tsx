'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { formatUsd } from '@/lib/utils'
import { StatCard } from './StatCard'
import { ExportButton } from './ExportButton'
import { DataTable } from './DataTable'

type UsageStats = {
  period: string
  summary: { totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalRevenue: number; totalCost: number; grossProfit: number; margin: string }
  byProvider: Array<{ provider: string; totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalRevenue: number; totalCost: number; profit: number }>
  byModel: Array<{ model: string; provider: string; totalRequests: number; totalInputTokens: number; totalOutputTokens: number; totalRevenue: number }>
  dailyUsage: Array<{ date: string; totalRequests: number; totalRevenue: number }>
}

type UsageTabProps = {
  usageStats: UsageStats | null
  usagePeriod: string
  setUsagePeriod: (period: string) => void
  exportCSV: (data: unknown[], filename: string) => void
  isError?: boolean
  onRetry?: () => void
}

export function UsageTab({ usageStats, usagePeriod, setUsagePeriod, exportCSV, isError, onRetry }: UsageTabProps) {
  if (isError && !usageStats) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-12 h-12 rounded-xl border border-error/30 bg-error/5 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-error" aria-hidden="true" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-text-bright mb-1">Failed to load data</p>
          <p className="text-xs text-text-muted font-mono">An error occurred while fetching usage statistics.</p>
        </div>
        <button type="button"
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface text-text-muted hover:text-text hover:border-border-bright transition-colors text-sm font-mono"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          Retry
        </button>
      </div>
    )
  }

  return (
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
          <ExportButton
            onClick={() => exportCSV(usageStats.dailyUsage, `usage-${usagePeriod}`)}
          />
        )}
      </div>

      {!usageStats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded border border-border bg-surface p-5 animate-pulse">
                <div className="h-3 w-20 bg-border rounded mb-3" />
                <div className="h-7 w-24 bg-border rounded" />
              </div>
            ))}
          </div>

          {Array.from({ length: 2 }).map((_, ti) => (
            <div key={ti} className="rounded border border-border bg-surface overflow-hidden animate-pulse">
              <div className="px-4 py-3 border-b border-border bg-panel">
                <div className="h-4 w-24 bg-border rounded" />
              </div>
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, ri) => (
                  <div key={ri} className="h-6 bg-border rounded" />
                ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard className="p-5" label="Total Requests" value={usageStats.summary.totalRequests.toLocaleString()} />
            <StatCard className="p-5" label="Total Revenue" value={formatUsd(usageStats.summary.totalRevenue)} valueClassName="text-success" />
            <StatCard className="p-5" label="Total Cost" value={formatUsd(usageStats.summary.totalCost)} valueClassName="text-amber" />
            <StatCard className="p-5" label="Gross Profit" value={formatUsd(usageStats.summary.grossProfit)} valueClassName="text-accent" subtitle={`Margin: ${usageStats.summary.margin}`} />
          </div>

          <DataTable title="By Provider">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-panel">
                  <th scope="col" className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Provider</th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Requests</th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Revenue</th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Cost</th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {usageStats.byProvider.map((p) => (
                  <tr key={p.provider} className="border-b border-border/50 hover:bg-surface/50">
                    <td className="px-4 py-3 font-medium text-text-bright capitalize text-sm">{p.provider}</td>
                    <td className="px-4 py-3 text-right font-mono text-text-muted">{p.totalRequests.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-success">{formatUsd(p.totalRevenue)}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber">{formatUsd(p.totalCost)}</td>
                    <td className="px-4 py-3 text-right font-mono text-accent">{formatUsd(p.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>

          <DataTable title="Top Models">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-panel">
                  <th scope="col" className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Model</th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Requests</th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Input Tokens</th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Output Tokens</th>
                  <th scope="col" className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {usageStats.byModel.map((m) => (
                  <tr key={m.model} className="border-b border-border/50 hover:bg-surface/50">
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm text-text-bright">{m.model}</div>
                      <div className="text-[10px] text-text-muted capitalize">{m.provider}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-muted">{m.totalRequests.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-text-muted">{m.totalInputTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-text-muted">{m.totalOutputTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-success">{formatUsd(m.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTable>
        </>
      )}
    </div>
  )
}
