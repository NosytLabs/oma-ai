import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading crypto payments"
      className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 animate-pulse"
    >
      <Skeleton className="h-3 w-32 mb-3" />
      <Skeleton className="h-12 w-2/3 mb-3" />
      <Skeleton className="h-4 w-1/2 mb-10" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 mb-10">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] p-6 space-y-3"
          >
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] p-6 space-y-3">
        <Skeleton className="h-4 w-1/3 mb-2" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-10/12" />
      </div>
    </div>
  )
}
