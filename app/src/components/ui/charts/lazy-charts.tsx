'use client'

import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/Skeleton'

const AreaChartComponent = dynamic(
  () => import('./AreaChart').then(mod => mod.AreaChartComponent),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full" />
  }
)

const BarChartComponent = dynamic(
  () => import('./BarChart').then(mod => mod.BarChartComponent),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[280px] w-full" />
  }
)

const DonutChart = dynamic(
  () => import('./DonutChart').then(mod => mod.DonutChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[280px] w-full" />
  }
)

export { AreaChartComponent, BarChartComponent, DonutChart }
export type { DataPoint } from './AreaChart'
export type { CostData } from './BarChart'
export type { ModelData } from './DonutChart'