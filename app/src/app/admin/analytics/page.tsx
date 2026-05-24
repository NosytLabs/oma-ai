'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, TrendingUp, DollarSign, Users, BarChart3 } from 'lucide-react'
import dynamic from 'next/dynamic'

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
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-cyan-400 animate-spin" />
          <span className="text-zinc-400">Loading analytics...</span>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">Failed to load analytics</p>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display">Usage Analytics</h1>
                <p className="text-xs text-zinc-500">System-wide metrics and insights</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(['7d', '30d', '90d'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    period === p
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Total Requests</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(analytics.summary.totalRequests)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(analytics.summary.totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Gross Profit</span>
            </div>
            <p className="text-2xl font-bold text-cyan-400">{formatCurrency(analytics.summary.grossProfit)}</p>
            <p className="text-xs text-zinc-500 mt-1">Margin: {analytics.summary.margin}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-zinc-500" />
              <span className="text-xs text-zinc-500">Active Users</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(analytics.summary.uniqueUsers)}</p>
            <p className="text-xs text-zinc-500 mt-1">of {formatNumber(analytics.summary.totalUsers)} total</p>
          </div>
        </div>

        <AnalyticsCharts analytics={analytics} />
      </div>
    </div>
  )
}