"use client";

/**
 * Skeleton shown while wagmi initializes its connectors.
 *
 * The wagmi provider returns `isReady=false` until `useEffect`s have
 * populated the stored-session check + the connector registry. Without a
 * skeleton the Connect Wallet button renders then re-renders with new
 * state — a visible flicker. We pulse a placeholder block of the same
 * size so the layout doesn't shift.
 */
export function AuthSkeleton() {
	return (
		<div
			className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-panel/50 p-8 backdrop-blur-sm"
			role="status"
			aria-label="Loading authentication"
			aria-busy="true"
		>
			<div className="space-y-3">
				<div className="h-10 w-10 animate-pulse rounded-xl bg-surface-elevated" />
				<div className="h-6 w-1/2 animate-pulse rounded bg-surface-elevated" />
				<div className="h-4 w-3/4 animate-pulse rounded bg-surface" />
			</div>

			<div className="h-12 w-full animate-pulse rounded-lg bg-surface" />

			<div className="space-y-2">
				<div className="h-3 w-full animate-pulse rounded bg-surface/50" />
				<div className="h-3 w-5/6 animate-pulse rounded bg-surface/50" />
			</div>
			<span className="sr-only">Preparing secure session…</span>
		</div>
	);
}
