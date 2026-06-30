/**
 * Maps raw usage records to the data shapes consumed by the dashboard chart
 * components (`<AreaChartComponent>` and `<DonutChart>` in
 * `app/src/components/ui/charts/`).
 *
 * Extracted from `app/src/app/dashboard/page.tsx` so the pure mapping logic
 * is unit-testable without a React render harness.
 */
import { CHART_PALETTE } from '@/components/ui/charts/shared'
import { toDollars } from '@/lib/utils'

/** Raw shape returned by `api.oma.getUsage()` — mirrors `UsageRecord`. */
export interface UsageRecordLike {
  id: string
  model: string
  promptTokens: number
  completionTokens: number
  /** Backend stores cents as a string (decimal numeric). */
  costCents: string | number
  createdAt: string
}

/** Shape consumed by `<AreaChartComponent>` (date, requests, cost). */
export interface ChartDataPoint {
  date: string
  requests: number
  cost: number
}

/** Shape consumed by `<DonutChart>` (name, value, color). */
export interface ChartModelDatum {
  name: string
  value: number
  color: string
}

/**
 * Group usage records by ISO date (YYYY-MM-DD) and aggregate request count +
 * total cost (cents → dollars) per day. Returns the last `windowDays` of
 * the date-sorted series so the chart always shows a stable trailing window
 * even when the API returns a longer history.
 *
 * Empty input → empty output. The chart components render a zero-state in
 * that case (or show the loading skeleton via `LazyUsageChart`).
 */
export function mapUsageToChartData(
  usage: readonly UsageRecordLike[],
  windowDays = 7,
): ChartDataPoint[] {
  if (usage.length === 0) return []
  const byDay = new Map<string, { requests: number; cost: number }>()
  for (const u of usage) {
    const day = new Date(u.createdAt).toISOString().slice(0, 10)
    const prev = byDay.get(day) ?? { requests: 0, cost: 0 }
    prev.requests += 1
    prev.cost += toDollars(u.costCents)
    byDay.set(day, prev)
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(-windowDays)
    .map(([date, v]) => ({ date, requests: v.requests, cost: v.cost }))
}

/**
 * Group usage records by model and aggregate total cost per model
 * (cents → dollars). Returns the top `topN` models sorted by cost
 * descending, each assigned a stable color from `CHART_PALETTE`.
 *
 * Empty input → empty output.
 */
export function mapUsageToModelData(
  usage: readonly UsageRecordLike[],
  topN = 5,
): ChartModelDatum[] {
  if (usage.length === 0) return []
  const byModel = new Map<string, number>()
  for (const u of usage) {
    byModel.set(u.model, (byModel.get(u.model) ?? 0) + toDollars(u.costCents))
  }
  return Array.from(byModel.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([name, value], i) => ({
      name,
      value,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
    }))
}
