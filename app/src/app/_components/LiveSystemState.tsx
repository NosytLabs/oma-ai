'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { HealthResponse, ModelsResponse } from '@/lib/api/types'

interface LiveStatsState {
  status: 'connecting' | 'ok' | 'degraded' | 'unreachable'
  version: string
  uptimeSeconds: number
  modelCount: number | null
  providers: Array<{ id: string; ok: boolean }>
}

function LiveIndicator({ tone = 'accent' }: { tone?: 'accent' | 'warning' | 'error' }) {
  const color =
    tone === 'warning'
      ? 'var(--color-warning)'
      : tone === 'error'
        ? 'var(--color-error)'
        : 'var(--color-accent)'
  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-1.5 w-1.5"
        style={{ backgroundColor: color }}
      />
    </span>
  )
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds < 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

const PROVIDER_LABELS: Record<string, string> = {
  venice: 'Venice',
  antseed: 'AntSeed',
  tinyfish: 'TinyFish',
  openrouter: 'OpenRouter',
  together: 'Together',
  claude: 'Claude',
  gemini: 'Gemini',
}

export function LiveSystemState() {
  const [stats, setStats] = useState<LiveStatsState>({
    status: 'connecting',
    version: '—',
    uptimeSeconds: 0,
    modelCount: null,
    providers: [],
  })

  useEffect(() => {
    let cancelled = false

    const fetchHealth = async () => {
      try {
        const h: HealthResponse = await api.health()
        if (cancelled) return
        const ok = h?.status === 'ok'
        const providerEntries = Object.entries(h?.checks ?? {}).map(([id, c]) => ({
          id,
          ok: c?.status === 'ok',
        }))
        setStats((s) => ({
          ...s,
          status: ok ? 'ok' : h?.status === 'degraded' ? 'degraded' : 'ok',
          version: h?.version ?? s.version,
          uptimeSeconds: typeof h?.uptime === 'number' ? h.uptime : s.uptimeSeconds,
          providers: providerEntries.length > 0 ? providerEntries : s.providers,
        }))
      } catch {
        if (cancelled) return
        setStats((s) => ({ ...s, status: 'unreachable' }))
      }
    }

    const fetchModels = async () => {
      try {
        const m: ModelsResponse = await api.models()
        if (cancelled) return
        setStats((s) => ({ ...s, modelCount: m?.data?.length ?? s.modelCount }))
      } catch {
        /* leave modelCount as null */
      }
    }

    fetchHealth()
    fetchModels()
    const id = setInterval(fetchHealth, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const tone = stats.status === 'unreachable' ? 'error' : stats.status === 'degraded' ? 'warning' : 'accent'
  const providerSummary = stats.providers.length > 0
    ? `${stats.providers.filter((p) => p.ok).length}/${stats.providers.length} up`
    : '—'
  const settlement = 'Base · USDC'
  const facilitator = stats.status === 'unreachable' ? 'unreachable' : stats.status === 'degraded' ? 'degraded' : 'mock · dev'

  return (
    <aside
      aria-label="System state"
      className="border border-border bg-surface min-w-0 animate-fade-in"
      style={{ animationDelay: '180ms' }}
    >
      <div className="px-3 py-2 border-b border-border bg-panel flex items-center justify-between">
        <span className="text-[10px] uppercase text-text-muted">System state</span>
        <span className="flex items-center gap-1.5 text-[10px] text-accent">
          <LiveIndicator tone={tone} />
          <span className="sr-only">System status: </span>
          {stats.status === 'connecting' && 'connecting…'}
          {stats.status === 'ok' && 'live'}
          {stats.status === 'degraded' && 'degraded'}
          {stats.status === 'unreachable' && 'offline'}
        </span>
      </div>
      <dl className="text-[11px]">
        {[
          ['Version', stats.version],
          ['Uptime', formatUptime(stats.uptimeSeconds)],
          ['Facilitator', facilitator],
          ['Settlement', settlement],
          ['Providers', providerSummary],
          ['Models', stats.modelCount !== null ? `${stats.modelCount} live` : 'loading…'],
        ].map(([k, v]) => (
          <div
            key={k}
            className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b border-border last:border-b-0"
          >
            <dt className="text-text-tertiary uppercase text-[10px]">{k}</dt>
            <dd className="text-text-secondary tabular-nums truncate text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {stats.providers.length > 0 && (
        <div className="px-3 py-2 border-t border-border flex flex-wrap gap-x-3 gap-y-1">
          {stats.providers.slice(0, 4).map((p) => (
            <span
              key={p.id}
              className="flex items-center gap-1 text-[10px] text-text-tertiary tabular-nums"
            >
              <span
                className="inline-block h-1 w-1 rounded-full"
                style={{ backgroundColor: p.ok ? 'var(--color-accent)' : 'var(--color-error)' }}
                aria-hidden="true"
              />
              {PROVIDER_LABELS[p.id] ?? p.id}
            </span>
          ))}
        </div>
      )}
    </aside>
  )
}
