export default function Loading() {
  return (
    <div className="min-h-dvh bg-[var(--color-void)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl animate-pulse space-y-6">
        <div className="h-8 w-32 bg-[var(--color-surface)]" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-6 space-y-4">
            <div className="h-6 w-32 bg-[var(--color-surface)]" />
            <div className="space-y-3">
              <div className="h-4 w-full bg-[var(--color-surface)]" />
              <div className="h-4 w-3/4 bg-[var(--color-surface)]" />
              <div className="h-4 w-1/2 bg-[var(--color-surface)]" />
            </div>
          </div>
          <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-6 space-y-4">
            <div className="h-6 w-32 bg-[var(--color-surface)]" />
            <div className="space-y-3">
              <div className="h-4 w-full bg-[var(--color-surface)]" />
              <div className="h-4 w-3/4 bg-[var(--color-surface)]" />
              <div className="h-4 w-1/2 bg-[var(--color-surface)]" />
            </div>
          </div>
        </div>
        <div className="border border-[var(--color-border)] bg-[var(--color-panel)] p-6 space-y-4">
          <div className="h-6 w-40 bg-[var(--color-surface)]" />
          <div className="h-64 w-full bg-[var(--color-surface)]" />
        </div>
      </div>
    </div>
  )
}
