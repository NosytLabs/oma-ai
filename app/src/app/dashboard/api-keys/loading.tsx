import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading API keys"
      className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 animate-pulse"
    >
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-10 w-64 mb-6" />
      <div className="rounded-2xl border border-border/50 bg-surface p-6 space-y-3 mb-6">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-surface p-5 flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-9 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
