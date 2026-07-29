export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="space-y-3">
        <div className="h-7 w-48 animate-pulse bg-surface" />
        <div className="h-4 w-72 max-w-full animate-pulse bg-surface" style={{ animationDelay: "80ms" }} />
      </div>

      {/* Export cards */}
      <div className="mt-10 space-y-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="border border-border bg-void p-5 animate-pulse"
            style={{ animationDelay: `${160 + i * 150}ms` }}
          >
            <div className="h-4 w-32 bg-surface" />
            <div className="mt-2.5 h-3 w-56 max-w-full bg-surface" />
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="h-9 w-28 bg-surface" />
              <div className="h-9 w-28 bg-surface" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
