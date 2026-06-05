interface QuickStatsCardProps {
  loading: boolean
  todayRequests: number
  todayCost: number
  activeModels: number
}

export function QuickStatsCard({ loading, todayRequests, todayCost, activeModels }: QuickStatsCardProps) {
  return (
    <div className="flex flex-col p-6 bg-[var(--color-void)]">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">TELEMETRY_24H</h2>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">SYS.STATS.TODAY</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center border border-[var(--color-secondary)]/20 bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]">
          <span className="text-xs font-mono">Tx</span>
        </div>
      </div>

      <div className="flex-1 space-y-0 border border-[var(--color-border)]">
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <span className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">REQUESTS</span>
          <span className="text-sm font-medium text-[var(--color-text)]">{loading ? '...' : todayRequests}</span>
        </div>
        <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
          <span className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">SPEND</span>
          <span className="text-sm font-medium text-[var(--color-secondary)]">
            {loading ? '...' : `$${todayCost.toFixed(2)}`}
          </span>
        </div>
        <div className="flex items-center justify-between p-3">
          <span className="text-xs uppercase tracking-widest text-[var(--color-text-muted)]">MODELS</span>
          <span className="text-sm font-medium text-[var(--color-success)]">{loading ? '...' : activeModels}</span>
        </div>
      </div>
    </div>
  )
}