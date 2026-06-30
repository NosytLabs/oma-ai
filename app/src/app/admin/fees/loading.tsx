export default function Loading() {
  return (
    <div className="min-h-dvh bg-void px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="h-8 w-48 bg-surface" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-border bg-panel p-6 space-y-3">
              <div className="h-5 w-40 bg-surface" />
              <div className="h-4 w-full bg-surface" />
              <div className="h-4 w-2/3 bg-surface" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
