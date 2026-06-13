import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading terms"
      className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 animate-pulse"
    >
      <Skeleton className="h-10 w-48 mb-6" />
      <div className="space-y-3">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  )
}
