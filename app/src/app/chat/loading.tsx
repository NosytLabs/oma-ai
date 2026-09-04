/**
 * /chat loading shell — server-safe (no client-only deps: this renders
 * during static prerender, where hook-based visuals like ThinkingOrb
 * crash the build). Pure CSS: pulsing orb ring + mono label + shimmer
 * bar, geometrically centered like the dynamic-import fallback in
 * page.tsx so the swap to the client shell doesn't shift layout.
 */
export default function Loading() {
	return (
		<div
			className="flex min-h-0 flex-1 flex-col overflow-hidden bg-void"
			role="status"
			aria-live="polite"
			aria-label="Loading chat playground"
		>
			<div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
				<div className="flex flex-col items-center gap-4">
					<span className="relative flex h-16 w-16 items-center justify-center" aria-hidden="true">
						<span className="absolute inline-flex h-full w-full rounded-full bg-accent/20 animate-ping" />
						<span className="relative inline-flex h-10 w-10 rounded-full border border-accent/50 bg-accent/10" />
						<span className="absolute inline-flex h-2 w-2 rounded-full bg-accent animate-pulse" />
					</span>
					<p className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
						Loading playground…
					</p>
					<div
						className="animate-shimmer h-1.5 w-48 max-w-full rounded-full bg-surface-elevated"
						aria-hidden="true"
					/>
				</div>
			</div>
		</div>
	);
}
