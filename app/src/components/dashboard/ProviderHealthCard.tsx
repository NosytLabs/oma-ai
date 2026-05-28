'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function ProviderHealthCard() {
  const { data: health, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.health(),
    staleTime: 25000,
    refetchInterval: 30000,
  })

  const providers = health?.checks ? [
    {
      name: 'Database',
      status: health.checks.database?.status === 'ok' ? 'operational' : 'outage',
      latency: health.checks.database?.latency || 0,
    },
    {
      name: 'Redis',
      status: health.checks.redis?.status === 'ok' ? 'operational' : 'outage',
      latency: health.checks.redis?.latency || 0,
    },
    {
      name: 'Venice AI',
      status: health.checks.venice?.status === 'ok' ? 'operational' : 
              health.checks.venice?.status === 'degraded' ? 'degraded' : 'outage',
      latency: health.checks.venice?.latency || 0,
    }
  ] : []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-[var(--color-success)]'
      case 'degraded': return 'text-[var(--color-secondary)]'
      default: return 'text-[var(--color-pink)]'
    }
  }

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-[var(--color-success)]'
      case 'degraded': return 'bg-[var(--color-secondary)]'
      default: return 'bg-[var(--color-pink)]'
    }
  }

  return (
    <div className="flex flex-col p-6">
      <div className="mb-6 flex items-center justify-between border-b border-[var(--color-border)] pb-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">SYS.HEALTH</h2>
        </div>
        {!isLoading && !isError && health && (
          <div aria-live="polite" className="flex items-center gap-2 border border-[var(--color-border)] px-3 py-1">
            <span className={`inline-block h-2 w-2 ${health.status === 'ok' ? 'bg-[var(--color-success)]' : health.status === 'degraded' ? 'bg-[var(--color-secondary)]' : 'bg-[var(--color-pink)]'}`} />
            <span className={`text-[10px] uppercase tracking-widest ${getStatusColor(health.status)}`}>
              {health.status}
            </span>
          </div>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex items-center gap-2 p-4 text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
          <span className="inline-block h-2 w-2 bg-[var(--color-text-muted)] animate-pulse" />
          POLLING_SENSORS...
        </div>
      ) : isError ? (
        <div className="border border-[var(--color-error-bg)] bg-[var(--color-error-bg)] p-4 text-xs uppercase tracking-widest text-[var(--color-pink)]">
          ERR_HEALTH_CHECK_FAILED
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--color-border)]">
          {providers.map((provider) => (
            <div key={provider.name} className="flex flex-col justify-between p-4 bg-[var(--color-void)]">
              <div className="mb-4 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">{provider.name}</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-1.5 w-1.5 ${getStatusDot(provider.status)}`} />
                  <span className={`text-xs uppercase tracking-widest ${getStatusColor(provider.status)}`}>
                    {provider.status}
                  </span>
                </div>
                {provider.latency > 0 && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">{provider.latency}MS</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}