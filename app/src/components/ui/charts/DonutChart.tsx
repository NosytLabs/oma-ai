'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { m } from 'framer-motion'

export interface ModelData {
  name: string
  value: number
  color: string
}

interface DonutChartProps {
  data: ModelData[]
  label?: string
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{payload: ModelData}> }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="rounded-lg border border-border bg-surface/95 px-3 py-2 shadow-xl">
        <p className="text-xs text-text-muted">{data.name}</p>
        <p className="text-sm font-semibold text-text-bright">{data.value.toLocaleString()}</p>
      </div>
    )
  }
  return null
}

export function DonutChart({ data, label = 'Total' }: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const chartDescription = `Donut chart showing ${data.map(d => `${d.name}: ${d.value.toLocaleString()}`).join(', ')}. Total: ${total.toLocaleString()}`

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative h-[280px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart role="img" aria-label={chartDescription}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-text-bright">{total.toLocaleString()}</span>
        <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
      </div>
    </m.div>
  )
}

