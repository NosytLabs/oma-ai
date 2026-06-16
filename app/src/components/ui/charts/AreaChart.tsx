'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { m } from 'framer-motion'
import { format } from 'date-fns'

export interface DataPoint {
  date: string
  requests: number
  cost: number
}

interface AreaChartComponentProps {
  data: DataPoint[]
  showCostArea?: boolean
}

const CustomTooltip = ({ active, payload, label, showCost }: { active?: boolean; payload?: Array<{value: number; name?: string}>; label?: string; showCost?: boolean }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-surface/95 px-3 py-2 shadow-xl">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-sm font-semibold text-accent">{payload[0].value.toLocaleString()} requests</p>
        {showCost && payload[0].name === 'cost' && (
          <p className="text-sm font-semibold text-amber">${payload[0].value.toFixed(2)}</p>
        )}
      </div>
    )
  }
  return null
}

export function AreaChartComponent({ data, showCostArea = true }: AreaChartComponentProps) {
  const totalRequests = data.reduce((sum, d) => sum + d.requests, 0)
  const totalCost = data.reduce((sum, d) => sum + d.cost, 0)
  const chartDescription = `Area chart showing ${data.length} days of usage data. Total requests: ${totalRequests.toLocaleString()}. Total cost: $${totalCost.toFixed(2)}`

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[300px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} role="img" aria-label={chartDescription}>
          <defs>
            <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
            {showCostArea && (
              <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="var(--color-text-tertiary)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => format(new Date(value), 'EEE')}
          />
          <YAxis
            stroke="var(--color-text-tertiary)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
          />
          <Tooltip content={<CustomTooltip showCost={showCostArea} />} />
          <Area
            type="monotone"
            dataKey="requests"
            stroke="var(--color-accent)"
            strokeWidth={2}
            fill="url(#colorRequests)"
            animationDuration={1000}
          />
          {showCostArea && (
            <Area
              type="monotone"
              dataKey="cost"
              stroke="var(--color-secondary)"
              strokeWidth={2}
              fill="url(#colorCost)"
              animationDuration={1000}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </m.div>
  )
}

