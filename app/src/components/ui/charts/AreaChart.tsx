'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { format, subDays } from 'date-fns'

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
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-3 py-2 shadow-xl">
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
        <p className="text-sm font-semibold text-[var(--color-cyan)]">{payload[0].value.toLocaleString()} requests</p>
        {showCost && payload[0].name === 'cost' && (
          <p className="text-sm font-semibold text-[var(--color-amber)]">${payload[0].value.toFixed(2)}</p>
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[300px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} role="img" aria-label={chartDescription}>
          <defs>
            <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00ffc8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00ffc8" stopOpacity={0} />
            </linearGradient>
            {showCostArea && (
              <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffb800" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ffb800" stopOpacity={0} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#71717a" 
            fontSize={11} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => format(new Date(value), 'EEE')}
          />
          <YAxis 
            stroke="#71717a" 
            fontSize={11} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
          />
          <Tooltip content={<CustomTooltip showCost={showCostArea} />} />
          <Area 
            type="monotone" 
            dataKey="requests" 
            stroke="#00ffc8" 
            strokeWidth={2}
            fill="url(#colorRequests)"
            animationDuration={1000}
          />
          {showCostArea && (
            <Area 
              type="monotone" 
              dataKey="cost" 
              stroke="#ffb800" 
              strokeWidth={2}
              fill="url(#colorCost)"
              animationDuration={1000}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

export function generateUsageData(days: number = 7): DataPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const date = subDays(new Date(), days - 1 - i)
    return {
      date: format(date, 'yyyy-MM-dd'),
      requests: Math.floor(Math.random() * 500) + 100,
      cost: Math.random() * 10 + 1,
    }
  })
}