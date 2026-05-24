'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface MonthlyRevenue {
  month: string
  totalRevenue: number
  depositCount: number
}

export function AdminRevenueCharts({ monthlyRevenue }: { monthlyRevenue: MonthlyRevenue[] | undefined }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h3 className="text-sm font-medium text-white mb-4">Revenue Chart</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyRevenue?.slice(-12)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value) => [`${Number(value).toFixed(2)}`, 'Revenue']}
            />
            <Bar dataKey="totalRevenue" fill="#22d3ee" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
