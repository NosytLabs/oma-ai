export default function Loading() {
  return (
    <div className="min-h-dvh bg-[var(--color-void)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-[var(--color-surface)]" />
          <div className="h-8 w-40 bg-[var(--color-surface)]" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 h-80 border border-[var(--color-border)] bg-[var(--color-panel)]" />
          <div className="h-80 border border-[var(--color-border)] bg-[var(--color-panel)]" />
        </div>
        <div className="h-64 border border-[var(--color-border)] bg-[var(--color-panel)]" />
      </div>
    </div>
  )
}
