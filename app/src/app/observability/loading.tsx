const BARS = [42, 68, 55, 80, 62, 90, 74, 96, 70, 84, 58, 76];

export default function Loading() {
  return (
    <div className="min-h-dvh bg-void px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Hero */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl space-y-4">
            <div className="h-3 w-44 animate-pulse bg-surface" />
            <div className="h-11 w-80 max-w-full animate-pulse bg-surface" style={{ animationDelay: "80ms" }} />
            <div className="h-4 w-[26rem] max-w-full animate-pulse bg-surface" style={{ animationDelay: "160ms" }} />
          </div>
          <div
            className="flex items-center gap-2 border border-border bg-panel px-3 py-2 animate-pulse"
            style={{ animationDelay: "240ms" }}
          >
            <div className="h-2 w-2 bg-accent" />
            <div className="h-3 w-24 bg-surface" />
          </div>
        </div>

        {/* Stat chips */}
        <div className="mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-border bg-panel p-4 animate-pulse"
              style={{ animationDelay: `${320 + i * 100}ms` }}
            >
              <div className="h-2.5 w-20 bg-surface" />
              <div className="mt-3 h-7 w-24 bg-surface" />
              <div className="mt-2 h-2.5 w-16 bg-surface" />
            </div>
          ))}
        </div>

        {/* Bento: chart + sidecars */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* Request volume chart */}
          <div className="border border-border bg-panel p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-36 animate-pulse bg-surface" />
              <div className="h-3 w-20 animate-pulse bg-surface" style={{ animationDelay: "100ms" }} />
            </div>
            <div className="mt-6 flex h-40 items-end gap-2">
              {BARS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 animate-pulse bg-surface/70"
                  style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
                />
              ))}
            </div>
            <div className="mt-4 flex justify-between">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-2 w-10 bg-surface" />
              ))}
            </div>
          </div>

          {/* Sidecar panels */}
          <div className="grid gap-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="border border-border bg-panel p-5 animate-pulse"
                style={{ animationDelay: `${720 + i * 140}ms` }}
              >
                <div className="h-3.5 w-28 bg-surface" />
                <div className="mt-5 space-y-4">
                  {[0, 1, 2].map((r) => (
                    <div key={r} className="flex items-center justify-between">
                      <div className="h-3 w-20 bg-surface" />
                      <div className="h-3 w-12 bg-surface" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
