'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { format, subDays } from 'date-fns'

interface DataPoint {
  date: string
  requests: number
  cost: number
}

interface UsageChartProps {
  data: DataPoint[]
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{value: number; name?: string}>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-xl">
        <p className="text-xs text-zinc-400">{label}</p>
        <p className="text-sm font-semibold text-cyan-400">{payload[0].value.toLocaleString()} requests</p>
        {payload[0].name === 'cost' && (
          <p className="text-sm font-semibold text-amber-400">${payload[0].value.toFixed(2)}</p>
        )}
      </div>
    )
  }
  return null
}

export function AreaChartComponent({ data }: UsageChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[300px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00ffc8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00ffc8" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffb800" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ffb800" stopOpacity={0} />
            </linearGradient>
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
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="requests" 
            stroke="#00ffc8" 
            strokeWidth={2}
            fill="url(#colorRequests)"
            animationDuration={1000}
          />
          <Area 
            type="monotone" 
            dataKey="cost" 
            stroke="#ffb800" 
            strokeWidth={2}
            fill="url(#colorCost)"
            animationDuration={1000}
          />
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