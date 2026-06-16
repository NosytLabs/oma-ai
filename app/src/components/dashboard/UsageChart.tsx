'use client'

import dynamic from 'next/dynamic'
import { m } from 'framer-motion'
import Link from 'next/link'

const AreaChartComponent = dynamic(
  () => import('@/components/ui/charts').then((m) => m.AreaChartComponent),
  { ssr: false, loading: () => <div className="h-48 animate-pulse bg-surface" /> }
)

const DonutChart = dynamic(
  () => import('@/components/ui/charts').then((m) => m.DonutChart),
  { ssr: false, loading: () => <div className="h-48 animate-pulse bg-surface" /> }
)

export interface DataPoint {
  date: string
  requests: number
  cost: number
}

export interface ModelData {
  name: string
  value: number
  color: string
}

interface UsageChartProps {
  usageData: DataPoint[]
  modelData: ModelData[]
}

export function UsageChart({ usageData, modelData }: UsageChartProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border">
      <m.div
        className="bg-void p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">USAGE_7D</h3>
          <Link href="/dashboard/credits" aria-label="View usage details" className="text-[10px] uppercase tracking-widest text-success hover:text-success transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void">VIEW_DETAILS</Link>
        </div>
        <AreaChartComponent data={usageData} />
      </m.div>

      <m.div
        className="bg-void p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">MODEL_USAGE</h3>
          <Link href="/dashboard/credits" aria-label="View model usage breakdown" className="text-[10px] uppercase tracking-widest text-success hover:text-success/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void">BREAKDOWN</Link>
        </div>
        <DonutChart data={modelData} />
        <div className="mt-4 flex flex-wrap gap-3">
          {modelData.map((model) => (
            <div key={model.name} className="flex items-center gap-2">
              <div className="h-2 w-2" style={{ backgroundColor: model.color }} />
              <span className="text-[10px] text-text-muted">{model.name}</span>
            </div>
          ))}
        </div>
      </m.div>
    </div>
  )
}
