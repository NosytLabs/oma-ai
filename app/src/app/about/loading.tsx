import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 animate-pulse"
    >
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-10 w-2/3 mb-3" />
      <Skeleton className="h-4 w-1/2 mb-10" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-surface p-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="rounded-2xl border border-border/50 bg-surface p-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    </div>
  )
}
