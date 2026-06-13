import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading FAQ"
      className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 animate-pulse"
    >
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-10 w-64 mb-3" />
      <Skeleton className="h-4 w-1/2 mb-10" />
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface)] p-5 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  )
}
