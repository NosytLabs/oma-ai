'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/Skeleton'

const UsageChartLazy = dynamic(
  () => import('./UsageChart').then(mod => mod.UsageChart),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[var(--color-border)]">
        <div className="bg-[var(--color-void)] p-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-[300px] w-full" />
        </div>
        <div className="bg-[var(--color-void)] p-6">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-[280px] w-full" />
        </div>
      </div>
    )
  }
)

export { UsageChartLazy as UsageChart }
export type { DataPoint, ModelData } from './UsageChart'