'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, TrendingUp, DollarSign, Users, BarChart3, Terminal, RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'
import { motion, useReducedMotion } from 'framer-motion'

const AnalyticsCharts = dynamic(() => import('@/components/admin/AnalyticsCharts').then(m => ({ default: m.AnalyticsCharts })), { ssr: false })

type Period = '7d' | '30d' | '90d'

type ModelData = {
  model: string
  provider: string
  totalRequests: number
  totalCost: number
}

type DailyData = {
  date: string
  totalRequests: number
  totalRevenue: number
  totalCost: number
}

type AnalyticsOverview = {
  period: string
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
  byProvider: Array<{
    provider: string
    totalRequests: number
    totalRevenue: number
  }>
  byModel: ModelData[]
  dailyUsage: DailyData[]
  providerHealth: Array<{
    provider: string
    isUp: boolean
    latencyMs: number
    errorRate: number
  }>
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const shouldAnimate = !useReducedMotion()

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/analytics/overview?period=${period}`)
      const data = await res.json()
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    }
    setLoading(false)
  }, [period])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`
  const formatNumber = (num: number) => num.toLocaleString()

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-void)] text-[var(--color-text)] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <motion.div
            animate={shouldAnimate ? { rotate: 360 } : { rotate: 0 }}
            transition={shouldAnimate ? { duration: 1, repeat: Infinity, ease: "linear" } : { duration: 0 }}
            className="w-5 h-5 border border-[var(--color-cyan)] border-t-transparent rounded-full"
          />
          <span className="text-[var(--color-text-muted)] font-mono text-sm">Loading analytics...</span>
        </div>
      </div>
    )
  }

  if (!analytics || !analytics.summary) {
    return (
      <div className="min-h-screen bg-[var(--color-void)] text-[var(--color-text)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="w-8 h-8 text-[var(--color-accent)]" />
          </div>
          <h2 className="text-xl font-bold font-mono text-[var(--color-text-bright)] mb-2">No Analytics Data</h2>
          <p className="text-[var(--color-text-muted)] font-mono text-sm max-w-md mx-auto mb-6">
            Analytics data will populate once there is API usage on the gateway. Try refreshing or selecting a different period.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={fetchAnalytics}
              className="flex items-center gap-2 px-4 py-2 rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent-dim)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors text-sm font-mono"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-[var(--color-void)] text-[var(--color-text)]">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-[95rem] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded border border-[var(--color-cyan)]/30 bg-[var(--color-cyan)]/10 flex items-center justify-center">
                <Terminal className="w-4 h-4 text-[var(--color-cyan)]" />
              </div>
              <div>
                <h1 className="text-lg font-bold font-syne tracking-tight text-[var(--color-text-bright)]">Usage Analytics</h1>
                <p className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-widest">System-wide metrics</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {(['7d', '30d', '90d'] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                      period === p
                        ? 'bg-[var(--color-accent-dim)] text-[var(--color-cyan)] border border-[var(--color-accent)]/30'
                        : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={fetchAnalytics}
                className="p-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[95rem] mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Total Requests</span>
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--color-text-bright)]">{formatNumber(analytics.summary.totalRequests)}</p>
          </div>
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--color-success)]">{formatCurrency(analytics.summary.totalRevenue)}</p>
          </div>
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Gross Profit</span>
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--color-cyan)]">{formatCurrency(analytics.summary.grossProfit)}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-1">Margin: {analytics.summary.margin}</p>
          </div>
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Active Users</span>
            </div>
            <p className="text-2xl font-bold font-mono text-[var(--color-text-bright)]">{formatNumber(analytics.summary.uniqueUsers)}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-1">of {formatNumber(analytics.summary.totalUsers)} total</p>
          </div>
        </div>

        <AnalyticsCharts analytics={analytics} />
      </div>
    </div>
  )
}