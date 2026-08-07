const GRID = "grid grid-cols-[1.3fr_repeat(4,minmax(0,1fr))]";

export default function Loading() {
 return (
 <div className="min-h-dvh bg-void px-4 py-16 sm:px-6 lg:px-8">
 <div className="mx-auto max-w-6xl">
 {/* Hero */}
 <div className="max-w-2xl space-y-4">
 <div className="h-3 w-44 animate-pulse bg-surface" />
 <div className="h-11 w-96 max-w-full animate-pulse bg-surface" style={{ animationDelay: "80ms" }} />
 <div className="h-4 w-[30rem] max-w-full animate-pulse bg-surface" style={{ animationDelay: "160ms" }} />
 </div>

 {/* Comparison table */}
 <div className="mt-14 overflow-x-auto border border-border bg-panel">
 <div className="min-w-[680px]">
 {/* Header row */}
 <div className={`${GRID} border-b border-border`}>
 <div className="p-4" />
 {[0, 1, 2, 3, 4].map((i) => (
 <div
 key={i}
 className={`space-y-2 p-4 animate-pulse ${i === 0 ? "bg-accent-soft/30" : ""}`}
 style={{ animationDelay: `${i * 90}ms` }}
 >
 <div className="h-4 w-16 bg-surface" />
 <div className="h-2.5 w-20 bg-surface" />
 </div>
 ))}
 </div>

 {/* Feature rows */}
 {Array.from({ length: 12 }).map((_, r) => (
 <div
 key={r}
 className={`${GRID} items-center border-b border-border last:border-b-0 animate-pulse`}
 style={{ animationDelay: `${450 + r * 70}ms` }}
 >
 <div className="p-4">
 <div className="h-3 w-3/4 bg-surface" />
 </div>
 {[0, 1, 2, 3, 4].map((c) => (
 <div key={c} className={`flex justify-center p-4 ${c === 0 ? "bg-accent-soft/30" : ""}`}>
 <div className="h-4 w-4 bg-surface" />
 </div>
 ))}
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 );
}
