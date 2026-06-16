import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading use cases"
      className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 animate-pulse"
    >
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-12 w-2/3 mb-3" />
      <Skeleton className="h-4 w-1/2 mb-10" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-surface p-7 space-y-3"
          >
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
            <Skeleton className="h-3 w-1/3 mt-3" />
          </div>
        ))}
      </div>
    </div>
  )
}
