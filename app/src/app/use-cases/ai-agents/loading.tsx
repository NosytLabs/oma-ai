import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading AI agents use case"
      className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 animate-pulse"
    >
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-10 w-1/2 mb-3" />
      <Skeleton className="h-4 w-2/3 mb-10" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] p-5 space-y-2"
          >
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] p-6 space-y-3">
        <Skeleton className="h-3 w-1/4 mb-2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-10/12" />
        <Skeleton className="h-3 w-9/12" />
      </div>
    </div>
  )
}
