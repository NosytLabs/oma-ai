export default function Loading() {
  return (
    <div className="min-h-dvh bg-void px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl animate-pulse space-y-6">
        <div className="h-8 w-32 bg-surface" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 border border-border bg-panel" />
          ))}
        </div>
      </div>
    </div>
  )
}
