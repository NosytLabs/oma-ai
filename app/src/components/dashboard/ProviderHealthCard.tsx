'use client'

import { useHealthQuery } from '@/app/dashboard/_hooks/useHealthQuery'
import { formatTime } from '@/lib/utils'
import { getStatusLabel, TONE_TEXT, TONE_DOT, type CheckStatus } from './healthTone'

type CheckEntry = {
  id: string
  name: string
  status: CheckStatus
  latency?: number
  cooldownMs?: number
}

function humanize(id: string): string {
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return 'never'
  return formatTime(new Date(timestamp).toISOString())
}

export function ProviderHealthCard() {
  const { data: health, isLoading, isError, dataUpdatedAt } = useHealthQuery()

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
          <h2 className="text-sm font-semibold text-text-bright">Provider health</h2>
          <p className="mt-0.5 text-[11px] text-text-muted">Live status across all upstream routes</p>
        </div>
        {!isLoading && !isError && health && (() => {
          const overall = getStatusLabel(health.status as CheckStatus)
          return (
            <div aria-live="polite" className="flex items-center gap-2 border border-border px-3 py-1">
              <span className={`inline-block h-2 w-2 ${TONE_DOT[overall.tone]}`} />
              <span className={`text-[11px] font-medium ${TONE_TEXT[overall.tone]}`}>
                {overall.label}
              </span>
            </div>
          )
        })()}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-4 text-xs text-text-muted">
          <span className="inline-block h-2 w-2 bg-text-muted animate-pulse" />
          Polling providers…
        </div>
      ) : isError ? (
        <div className="border border-error-bg bg-error-bg p-4 text-xs text-pink">
          Health check failed
        </div>
      ) : checks.length === 0 ? (
        <div className="p-4 text-xs text-text-muted">
          No provider signals available.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {checks.map((check) => {
              const info = getStatusLabel(check.status)
              return (
                <div key={check.id} className="flex flex-col justify-between p-4 bg-void">
                  <div className="mb-4 text-xs font-medium text-text-secondary">{check.name}</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-1.5 w-1.5 ${TONE_DOT[info.tone]}`} />
                      <span className={`text-xs font-medium ${TONE_TEXT[info.tone]}`}>
                        {info.label}
                      </span>
                    </div>
                    {check.latency !== undefined && check.latency > 0 && (
                      <span className="text-[11px] text-text-muted font-mono">{check.latency}ms</span>
                    )}
                  </div>
                  {check.status === 'rate_limited' && typeof check.cooldownMs === 'number' && check.cooldownMs > 0 && (
                    <div className="mt-2 text-[11px] text-text-muted">
                      Retry in {Math.ceil(check.cooldownMs / 1000)}s
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-[11px] text-text-muted">
            Last checked {formatRelativeTime(dataUpdatedAt)}
          </div>
        </>
      )}
    </div>
  )
}
