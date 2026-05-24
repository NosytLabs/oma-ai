'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { motion } from 'framer-motion'

interface ModelData {
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
      <div className="rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-xl">
        <p className="text-xs text-zinc-400">{data.name}</p>
        <p className="text-sm font-semibold text-white">{data.value.toLocaleString()}</p>
      </div>
    )
  }
  return null
}

export function DonutChart({ data, label = 'Total' }: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative h-[280px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{total.toLocaleString()}</span>
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
    </motion.div>
  )
}

export function generateModelData(): ModelData[] {
  return [
    { name: 'GPT-4o', value: 3420, color: '#00ffc8' },
    { name: 'Claude Sonnet', value: 2180, color: '#ffb800' },
    { name: 'Gemini 2.5 Flash', value: 1560, color: '#a78bfa' },
    { name: 'DeepSeek V4', value: 890, color: '#f472b6' },
    { name: 'Others', value: 450, color: '#64748b' },
  ]
}