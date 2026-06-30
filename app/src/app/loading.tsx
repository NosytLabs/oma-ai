export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading app…" className="min-h-screen flex items-center justify-center">
      <p className="sr-only">Loading app…</p>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-text-secondary text-sm font-mono">Loading OMA…</p>
      </div>
    </div>
  )
}
