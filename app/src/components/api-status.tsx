'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'

type HealthStatus = 'checking' | 'online' | 'offline'

const POLL_INTERVAL_MS = 30_000
const TIMEOUT_MS = 5_000

let cachedStatus: HealthStatus = 'checking'
let cachedAt = 0
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

async function pollOnce() {
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const res = await fetch('/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      cachedStatus = res.ok ? 'online' : 'offline'
    } catch {
      cachedStatus = 'offline'
    } finally {
      cachedAt = Date.now()
      inFlight = null
      emit()
    }
  })()
  return inFlight
}

let started = false
function ensurePolling() {
  if (started || typeof window === 'undefined') return
  started = true
  void pollOnce()
  setInterval(() => void pollOnce(), POLL_INTERVAL_MS)
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  ensurePolling()
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): HealthStatus {
  return cachedStatus
}

function getServerSnapshot(): HealthStatus {
  return 'checking'
}

export function useApiHealth() {
  const status = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const refresh = useCallback(() => void pollOnce(), [])
  return { status, refresh, lastCheckedAt: cachedAt }
}

interface ApiStatusProps {
  onRetry?: () => void
  showRetryButton?: boolean
}

export function ApiStatus({ onRetry, showRetryButton = true }: ApiStatusProps) {
  const { status, refresh } = useApiHealth()

  const handleRetry = () => {
    refresh()
    onRetry?.()
  }

  const getStatusInfo = () => {
    switch (status) {
      case 'checking':
        return {
          icon: <RefreshCw className="h-3 w-3 animate-spin" />,
          text: 'Connecting...',
          className: 'text-text-muted',
          dotClass: 'bg-warning animate-pulse',
        }
      case 'online':
        return {
          icon: <Wifi className="h-3 w-3" />,
          text: 'API Online',
          className: 'text-success',
          dotClass: 'bg-success',
        }
      case 'offline':
        return {
          icon: <WifiOff className="h-3 w-3" />,
          text: 'Reconnecting…',
          className: 'text-warning',
          dotClass: 'bg-warning animate-pulse',
        }
    }
  }

  const info = getStatusInfo()

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <span className={`relative flex h-2 w-2`}>
          {status === 'checking' && (
            <span className={`absolute inline-flex h-full w-full rounded-full ${info.dotClass} opacity-75`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${info.dotClass}`} />
        </span>
        <span role="status" aria-live="polite" aria-label={`API Status: ${info.text}`} className={`text-[10px] ${info.className}`}>
          {info.text}
        </span>
      </div>
      {status === 'offline' && showRetryButton && (
        <button
          onClick={handleRetry}
          className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text transition-colors"
          aria-label="Retry connection"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export default ApiStatus
