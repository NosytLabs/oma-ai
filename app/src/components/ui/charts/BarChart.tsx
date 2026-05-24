'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { format, subDays } from 'date-fns'

interface CostData {
  date: string
  cost: number
}

interface BarChartComponentProps {
  data: CostData[]
  showCostLabels?: boolean
}

const CustomTooltip = ({ active, payload, label, showCost }: { active?: boolean; payload?: Array<{value: number}>; label?: string; showCost?: boolean }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-xl">
        <p className="text-xs text-zinc-400">{label}</p>
        <p className="text-sm font-semibold text-amber-400">{showCost ? `$${payload[0].value.toFixed(2)}` : payload[0].value.toLocaleString()}</p>
      </div>
    )
  }
  return null
}

export function BarChartComponent({ data, showCostLabels = true }: BarChartComponentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[280px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffb800" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#ffb800" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#71717a" 
            fontSize={11} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => format(new Date(value), 'MMM d')}
          />
          <YAxis 
            stroke="#71717a" 
            fontSize={11} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => showCostLabels ? `$${value}` : value.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip showCost={showCostLabels} />} cursor={{ fill: '#27272a' }} />
          <Bar 
            dataKey="cost" 
            fill="url(#costGradient)" 
            radius={[4, 4, 0, 0]}
            animationDuration={1000}
          />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

export function generateCostData(days: number = 30): CostData[] {
  return Array.from({ length: days }, (_, i) => {
    const date = subDays(new Date(), days - 1 - i)
    return {
      date: format(date, 'yyyy-MM-dd'),
      cost: Math.random() * 50 + 5,
    }
  })
}