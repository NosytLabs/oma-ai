import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading privacy policy"
      className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 animate-pulse"
    >
      <Skeleton className="h-10 w-56 mb-6" />
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  )
}
