export default function Loading() {
  return (
    <div className="min-h-dvh bg-void px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Hero */}
        <div className="max-w-2xl space-y-4">
          <div className="h-3 w-40 animate-pulse bg-surface" />
          <div className="h-11 w-80 max-w-full animate-pulse bg-surface" style={{ animationDelay: "80ms" }} />
          <div className="h-4 w-[28rem] max-w-full animate-pulse bg-surface" style={{ animationDelay: "160ms" }} />
        </div>

        {/* Primitives grid */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="border border-border bg-panel p-5 animate-pulse"
              style={{ animationDelay: `${240 + i * 100}ms` }}
            >
              <div className="h-9 w-9 bg-surface" />
              <div className="mt-4 h-4 w-32 bg-surface" />
              <div className="mt-3 space-y-2">
                <div className="h-3 w-full bg-surface" />
                <div className="h-3 w-2/3 bg-surface" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
