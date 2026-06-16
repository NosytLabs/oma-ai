interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded h-3',
    circular: 'rounded-full',
    rectangular: 'rounded',
  }
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  }

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`skeleton ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  )
}

export function SkeletonCard({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="skeleton-card"
      role="presentation"
      aria-label="Loading content"
    >
      <div className="flex items-center gap-4 mb-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" height={12} />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} variant="text" width={`${100 - i * 10}%`} />
        ))}
      </div>
    </div>
  )
}

export function SkeletonTableRow({ columns = 4, rowIndex = 0 }: { columns?: number; rowIndex?: number }) {
  return (
    <tr className="border-b border-border animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-4 px-5">
          <Skeleton
            variant="text"
            width={`${((rowIndex * 7 + i * 13) % 40) + 60}%`}
            className={i === columns - 1 ? 'ml-auto' : ''}
          />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonStatsCard() {
  return (
    <div
      className="border border-border bg-panel p-6 text-center animate-pulse"
      role="presentation"
      aria-label="Loading statistics"
    >
      <Skeleton variant="text" width="40px" height={36} className="mx-auto mb-2" />
      <Skeleton variant="text" width="80px" />
    </div>
  )
}

export function SkeletonCodeBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div
      className="border border-border bg-panel p-6 rounded-lg font-mono animate-pulse"
      role="presentation"
      aria-label="Loading code"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="mb-2">
          <Skeleton variant="text" width={`${100 - i * 15}%`} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel">
      <div className="border-b border-border bg-gradient-to-r from-indigo-500/5 to-purple-500/5 px-6 py-4">
        <div className="flex gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <table className="w-full">
        <tbody className="divide-y divide-border/50">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="flex gap-4 px-6 py-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-20" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function SkeletonKeyList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card flex items-center gap-4 py-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonEmptyState({ message = 'No data yet' }: { message?: string }) {
  return (
    <div className="card flex items-center justify-center py-12">
      <div className="text-center">
        <Skeleton className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <span className="text-sm text-text-secondary">{message}</span>
      </div>
    </div>
  )
}

