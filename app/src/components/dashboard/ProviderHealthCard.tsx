'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

type CheckStatus = 'ok' | 'degraded' | 'rate_limited' | 'circuit_open' | string

type CheckEntry = {
  id: string
  name: string
  status: CheckStatus
  latency?: number
  cooldownMs?: number
}

function getStatusLabel(status: CheckStatus): { label: string; tone: 'green' | 'yellow' | 'orange' | 'red' } {
  if (status === 'ok') return { label: 'Operational', tone: 'green' }
  if (status === 'degraded') return { label: 'Degraded', tone: 'yellow' }
  if (status === 'rate_limited') return { label: 'Rate limited', tone: 'orange' }
  if (status === 'circuit_open') return { label: 'Circuit open', tone: 'red' }
  return { label: 'Outage', tone: 'red' }
}

function toneClass(tone: 'green' | 'yellow' | 'orange' | 'red'): { text: string; dot: string } {
  switch (tone) {
    case 'green':
      return { text: 'text-success', dot: 'bg-success' }
    case 'yellow':
      return { text: 'text-secondary', dot: 'bg-secondary' }
    case 'orange':
      return { text: 'text-warning', dot: 'bg-warning' }
    case 'red':
    default:
      return { text: 'text-pink', dot: 'bg-pink' }
  }
}

function humanize(id: string): string {
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return 'never'
  const diffMs = Date.now() - timestamp
  if (diffMs < 1000) return 'just now'
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`
  return `${Math.floor(diffMs / 3_600_000)}h ago`
}

export function ProviderHealthCard() {
  const { data: health, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    staleTime: 25000,
    refetchInterval: 30000,
  })

  const checks: CheckEntry[] = health?.checks
    ? Object.entries(health.checks).map(([id, raw]) => {
        const entry = (raw ?? {}) as { status?: CheckStatus; latency?: number; cooldownMs?: number }
        return {
          id,
          name: humanize(id),
          status: entry.status ?? 'outage',
          latency: entry.latency,
          cooldownMs: entry.cooldownMs,
        }
      })
    : []

  return (
    <div className="flex flex-col p-6">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted">SYS.HEALTH</h2>
        </div>
        {!isLoading && !isError && health && (() => {
          const overall = getStatusLabel(health.status as CheckStatus)
          const colors = toneClass(overall.tone)
          return (
            <div aria-live="polite" className="flex items-center gap-2 border border-border px-3 py-1">
              <span className={`inline-block h-2 w-2 ${colors.dot}`} />
              <span className={`text-[10px] uppercase tracking-widest ${colors.text}`}>
                {overall.label}
              </span>
            </div>
          )
        })()}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-4 text-xs uppercase tracking-widest text-text-muted">
          <span className="inline-block h-2 w-2 bg-text-muted animate-pulse" />
          POLLING_SENSORS...
        </div>
      ) : isError ? (
        <div className="border border-error-bg bg-error-bg p-4 text-xs uppercase tracking-widest text-pink">
          ERR_HEALTH_CHECK_FAILED
        </div>
      ) : checks.length === 0 ? (
        <div className="p-4 text-xs uppercase tracking-widest text-text-muted">
          NO_HEALTH_SIGNALS
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {checks.map((check) => {
              const info = getStatusLabel(check.status)
              const colors = toneClass(info.tone)
              return (
                <div key={check.id} className="flex flex-col justify-between p-4 bg-void">
                  <div className="mb-4 text-[10px] uppercase tracking-widest text-text-muted">{check.name}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-1.5 w-1.5 ${colors.dot}`} />
                      <span className={`text-xs uppercase tracking-widest ${colors.text}`}>
                        {info.label}
                      </span>
                    </div>
                    {check.latency !== undefined && check.latency > 0 && (
                      <span className="text-[10px] text-text-muted">{check.latency}MS</span>
                    )}
                  </div>
                  {check.status === 'rate_limited' && typeof check.cooldownMs === 'number' && check.cooldownMs > 0 && (
                    <div className="mt-2 text-[10px] uppercase tracking-widest text-text-muted">
                      Retry in {Math.ceil(check.cooldownMs / 1000)}s
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-widest text-text-muted">
            Last checked {formatRelativeTime(dataUpdatedAt)}
          </div>
        </>
      )}
    </div>
  )
}
