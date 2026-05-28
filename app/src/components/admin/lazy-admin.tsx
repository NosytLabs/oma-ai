'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/Skeleton'

const AdminRevenueChartsLazy = dynamic(
  () => import('./AdminRevenueCharts').then(mod => mod.AdminRevenueCharts),
  {
    ssr: false,
    loading: () => (
      <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-[260px] w-full" />
      </div>
    )
  }
)

const AnalyticsChartsLazy = dynamic(
  () => import('./AnalyticsCharts').then(mod => mod.AnalyticsCharts),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <Skeleton className="h-4 w-40 mb-4" />
            <Skeleton className="h-[260px] w-full" />
          </div>
          <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <Skeleton className="h-4 w-28 mb-4" />
            <Skeleton className="h-[260px] w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[300px] w-full rounded" />
          <Skeleton className="h-[300px] w-full rounded" />
        </div>
      </div>
    )
  }
)

export { AdminRevenueChartsLazy as AdminRevenueCharts }
export { AnalyticsChartsLazy as AnalyticsCharts }