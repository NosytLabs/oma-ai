'use client'

import { AreaChart, Area, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

interface ChartDataPoint {
  date: string
  revenue: number
  cost: number
}

interface DailyUsage {
  date: string
  totalRequests: number
  totalRevenue: number
}

interface AdminOverviewChartsProps {
  chartData: ChartDataPoint[]
  dailyUsage: DailyUsage[] | undefined
}

export function AdminOverviewCharts({ chartData, dailyUsage }: AdminOverviewChartsProps) {
  return (
    <>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-5">
        <h3 className="text-sm font-medium text-white mb-4">Revenue Overview</h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData.slice(-30)}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-cyan)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--color-text-secondary)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  const d = new Date(value)
                  return format(d, 'MMM d')
                }}
              />
              <YAxis
                stroke="var(--color-text-secondary)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-panel)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value) => [`${Number(value).toFixed(2)}`, 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-cyan)"
                fill="url(#revenueGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/50 flex items-center justify-between">
          <h3 className="font-medium text-white">Recent Transactions</h3>
        </div>
        <div className="divide-y divide-[var(--color-border)]/50">
          {dailyUsage?.slice(-10).reverse().map((day, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-white">{format(new Date(day.date), 'MMM d, yyyy')}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{day.totalRequests.toLocaleString()} requests</p>
              </div>
              <p className="text-sm font-mono text-[var(--color-cyan)]">${day.totalRevenue.toFixed(2)}</p>
            </div>
          )) || (
            <div className="px-4 py-8 text-center text-[var(--color-text-muted)]">No transactions yet</div>
          )}
        </div>
      </div>
    </>
  )
}
