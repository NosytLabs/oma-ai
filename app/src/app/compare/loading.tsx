import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 animate-pulse"
    >
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-10 w-72 mb-3" />
      <Skeleton className="h-4 w-1/2 mb-8" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-surface p-6 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-4 w-1/3 mt-3" />
          </div>
        ))}
      </div>
    </div>
  )
}
