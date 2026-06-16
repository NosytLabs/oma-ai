interface QuickStatsCardProps {
  loading: boolean
  todayRequests: number
  todayCost: number
  activeModels: number
  requestDelta?: number
  costDelta?: number
  modelDelta?: number
}

function Trend({ value, suffix }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-text-muted">→ 0</span>
  const isUp = value > 0
  return (
    <span className={isUp ? 'text-success' : 'text-error'}>
      {isUp ? '↑' : '↓'} {Math.abs(value)}{suffix ?? ''}
    </span>
  )
}

export function QuickStatsCard({ loading, todayRequests, todayCost, activeModels, requestDelta, costDelta, modelDelta }: QuickStatsCardProps) {
  return (
    <div className="flex flex-col p-6 bg-void">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted">TELEMETRY_24H</h2>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-text-muted">SYS.STATS.TODAY</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center border border-secondary/20 bg-secondary/10 text-secondary">
          <span className="text-xs font-mono">Tx</span>
        </div>
      </div>

      <div className="flex-1 space-y-0 border border-border">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="text-xs uppercase tracking-widest text-text-muted">REQUESTS</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text">{loading ? '...' : todayRequests}</span>
            {!loading && requestDelta !== undefined && <Trend value={requestDelta} />}
          </div>
        </div>
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="text-xs uppercase tracking-widest text-text-muted">SPEND</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-secondary">
              {loading ? '...' : `$${todayCost.toFixed(2)}`}
            </span>
            {!loading && costDelta !== undefined && <Trend value={Math.round(costDelta * 100)} suffix="¢" />}
          </div>
        </div>
        <div className="flex items-center justify-between p-3">
          <span className="text-xs uppercase tracking-widest text-text-muted">MODELS</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-success">{loading ? '...' : activeModels}</span>
            {!loading && modelDelta !== undefined && <Trend value={modelDelta} />}
          </div>
        </div>
      </div>
    </div>
  )
}