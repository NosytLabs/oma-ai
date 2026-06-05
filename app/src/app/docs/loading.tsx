export default function Loading() {
  return (
    <div className="min-h-dvh bg-[var(--color-void)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl animate-pulse space-y-4">
        <div className="h-10 w-64 bg-[var(--color-surface)]" />
        <div className="h-4 w-full max-w-2xl bg-[var(--color-surface)]" />
        <div className="space-y-3 pt-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-4 w-full bg-[var(--color-surface)]" />
          ))}
        </div>
        <div className="h-64 border border-[var(--color-border)] bg-[var(--color-panel)] mt-6" />
      </div>
    </div>
  )
}
