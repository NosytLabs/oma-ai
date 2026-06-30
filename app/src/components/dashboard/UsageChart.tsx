'use client'

import dynamic from 'next/dynamic'
import { m } from 'framer-motion'
import type { DataPoint } from '@/components/ui/charts/AreaChart'
import type { ModelData } from '@/components/ui/charts/DonutChart'

const AreaChartComponent = dynamic(
  () => import('@/components/ui/charts').then((m) => m.AreaChartComponent),
  { ssr: false, loading: () => <div className="h-48 animate-pulse bg-surface" /> }
)

const DonutChart = dynamic(
  () => import('@/components/ui/charts').then((m) => m.DonutChart),
  { ssr: false, loading: () => <div className="h-48 animate-pulse bg-surface" /> }
)

interface UsageChartProps {
  usageData: DataPoint[]
  modelData: ModelData[]
  timeRange?: string
}

const TIME_LABELS: Record<string, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
  all: 'all time',
}

export function UsageChart({ usageData, modelData, timeRange = '7d' }: UsageChartProps) {
  const hasUsageData = usageData.length > 0
  const hasModelData = modelData.length > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border">
      <m.div
        className="bg-void p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-bright">Usage ({TIME_LABELS[timeRange] || timeRange})</h3>
        </div>
        {hasUsageData ? (
          <AreaChartComponent data={usageData} />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-border rounded-lg px-6 text-center">
            <p className="text-sm text-text-bright">No usage data yet</p>
            <p className="mt-1 text-xs text-text-muted">Start making API calls to see your activity here.</p>
          </div>
        )}
      </m.div>

      <m.div
        className="bg-void p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-bright">Model Breakdown</h3>
        </div>
        {hasModelData ? (
          <>
            <DonutChart data={modelData} />
            <div className="mt-4 flex flex-wrap gap-3">
              {modelData.map((model) => (
                <div key={model.name} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: model.color }} aria-hidden="true" />
                  <span className="text-xs text-text-muted">{model.name}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-border rounded-lg px-6 text-center">
            <p className="text-sm text-text-bright">No model usage data yet</p>
            <p className="mt-1 text-xs text-text-muted">Top models by cost will appear here.</p>
          </div>
        )}
      </m.div>
    </div>
  )
}
