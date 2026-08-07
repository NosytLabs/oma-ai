export default function Loading() {
 return (
 <div className="min-h-dvh bg-void px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
 <div className="mx-auto max-w-3xl">
 {/* Back link */}
 <div className="h-4 w-24 animate-pulse bg-surface" />

 {/* Heading */}
 <div className="mt-10 space-y-4">
 <div className="h-10 w-64 animate-pulse bg-surface" />
 <div className="h-4 w-96 max-w-full animate-pulse bg-surface" style={{ animationDelay: "80ms" }} />
 </div>

 {/* Channel cards */}
 <div className="mt-12 space-y-4">
 {[0, 1, 2].map((i) => (
 <div
 key={i}
 className="flex items-start gap-4 border border-border bg-panel p-6 animate-pulse"
 style={{ animationDelay: `${160 + i * 150}ms` }}
 >
 <div className="h-10 w-10 shrink-0 bg-surface" />
 <div className="flex-1 space-y-2.5 pt-0.5">
 <div className="h-4 w-44 bg-surface" />
 <div className="h-3 w-80 max-w-full bg-surface" />
 <div className="h-3 w-36 bg-surface" />
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 );
}
