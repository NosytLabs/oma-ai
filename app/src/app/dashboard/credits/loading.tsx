import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading credits"
      className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 animate-pulse"
    >
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-10 w-64 mb-6" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] p-6">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-10 w-32 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] p-6 space-y-3">
        <Skeleton className="h-4 w-32" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4 py-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
