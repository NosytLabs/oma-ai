const CHANGE_WIDTHS = ["88%", "72%", "80%", "60%"];

export default function Loading() {
  return (
    <div className="min-h-dvh bg-void px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Hero */}
        <div className="space-y-4 text-center">
          <div className="mx-auto h-3 w-36 animate-pulse bg-surface" />
          <div className="mx-auto h-11 w-72 max-w-full animate-pulse bg-surface" style={{ animationDelay: "80ms" }} />
          <div className="mx-auto h-4 w-96 max-w-full animate-pulse bg-surface" style={{ animationDelay: "160ms" }} />
        </div>

        {/* Latest release card */}
        <div
          className="mt-14 border border-border bg-panel p-6 animate-pulse sm:p-8"
          style={{ animationDelay: "240ms" }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-6 w-20 bg-surface" />
            <div className="h-3 w-24 bg-surface" />
            <div className="h-3 w-28 bg-surface" />
          </div>
          <div className="mt-5 space-y-2.5">
            <div className="h-4 w-3/4 bg-surface" />
            <div className="h-4 w-1/2 bg-surface" />
          </div>
          <div className="mt-6 space-y-3 border-t border-border pt-6">
            {CHANGE_WIDTHS.map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-1.5 w-1.5 shrink-0 bg-surface" />
                <div className="h-3 bg-surface" style={{ width: w }} />
              </div>
            ))}
          </div>
        </div>

        {/* Release archive */}
        <div className="mt-12 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border border-border bg-panel px-5 py-4 animate-pulse"
              style={{ animationDelay: `${400 + i * 120}ms` }}
            >
              <div className="h-6 w-16 shrink-0 bg-surface" />
              <div className="h-3 w-20 shrink-0 bg-surface" />
              <div className="h-3 flex-1 bg-surface" />
            </div>
          ))}
        </div>

        {/* Subscribe CTA */}
        <div
          className="mt-14 border border-border bg-panel p-6 text-center animate-pulse sm:p-8"
          style={{ animationDelay: "880ms" }}
        >
          <div className="mx-auto h-4 w-48 bg-surface" />
          <div className="mx-auto mt-3 h-3 w-64 max-w-full bg-surface" />
          <div className="mx-auto mt-5 h-10 w-40 bg-surface" />
        </div>
      </div>
    </div>
  );
}
