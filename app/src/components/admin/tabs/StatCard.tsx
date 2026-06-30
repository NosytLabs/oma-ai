'use client'

import type { ReactNode } from 'react'

type StatCardProps = {
  icon?: ReactNode
  label: string
  value: string
  valueClassName?: string
  subtitle?: string
  className?: string
  labelClassName?: string
}

export function StatCard({ icon, label, value, valueClassName = 'text-text-bright', subtitle, className, labelClassName }: StatCardProps) {
  return (
    <div className={`rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors ${className ?? ''}`}>
      {icon ? (
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <span className={`text-[10px] text-text-muted font-mono uppercase tracking-wider ${labelClassName ?? ''}`}>{label}</span>
        </div>
      ) : (
        <span className={`text-[10px] text-text-muted font-mono uppercase tracking-wider mb-3 block ${labelClassName ?? ''}`}>{label}</span>
      )}
      <p className={`text-2xl font-bold font-mono ${valueClassName}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-text-muted font-mono mt-1">{subtitle}</p>}
    </div>
  )
}
