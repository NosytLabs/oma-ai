'use client'

import { useEffect, useState } from 'react'
import { OmaLogo } from '@/components/ui/oma-logo'

export function LoadingSpinner({ fullScreen = true }: { fullScreen?: boolean }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div
      className={`flex items-center justify-center gap-4 ${
        fullScreen ? 'min-h-[50vh]' : 'py-8'
      }`}
      role="status"
      aria-label="Loading content"
    >
      <OmaLogo size={fullScreen ? 'lg' : 'sm'} />
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          <span className="animate-pulse delay-0 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          <span className="animate-pulse delay-75 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          <span className="animate-pulse delay-150 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
        </div>
        <span className="text-xs text-[var(--color-text-muted)] font-mono">
          Processing...
        </span>
      </div>
    </div>
  )
}

export function PageLoadingFallback() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <LoadingSpinner fullScreen={false} />
    </div>
  )
}
