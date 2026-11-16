/**
 * /deposit loading skeleton — mirrors the real page geometry (centered
 * max-w-4xl column, header lockup, 3-up payment tab bar, panel, then the
 * payment-methods card row) so the swap to the live page does not shift
 * layout or read as an empty box.
 */
export default function Loading() {
	return (
		<div
			className="container-page relative mx-auto max-w-3xl py-14 sm:py-18 lg:max-w-4xl lg:py-22"
			role="status"
			aria-label="Loading deposit page"
		>
			<div className="animate-pulse">
				{/* Header: icon box + title/subtitle, matching UnifiedDepositHeader */}
				<div className="mb-8 flex items-start gap-3 sm:items-center sm:gap-4">
					<div className="h-12 w-12 shrink-0 rounded-[var(--radius-lg)] border border-border-bright bg-surface" />
					<div className="min-w-0 flex-1 space-y-2">
						<div className="h-7 w-36 rounded bg-surface" />
						<div className="h-4 w-72 max-w-full rounded bg-surface" />
					</div>
				</div>

				{/* Payment method tab bar */}
				<div className="mt-6 grid grid-cols-3 gap-1 rounded-[var(--radius-lg)] border border-border bg-surface/40 p-1 sm:gap-2">
					{[...Array(3)].map((_, i) => (
						<div key={i} className="h-11 rounded-[var(--radius-md)] bg-surface" />
					))}
				</div>

				{/* Active panel */}
				<div className="mt-5 h-80 rounded-[var(--radius-lg)] border border-border bg-panel" />

				{/* Payment methods summary */}
				<div className="mt-8 rounded-[var(--radius-lg)] border border-border bg-surface/50 p-5">
					<div className="mb-3 h-3 w-32 rounded bg-surface" />
					<div className="grid gap-3 sm:grid-cols-3">
						{[...Array(3)].map((_, i) => (
							<div key={i} className="h-20 rounded-[var(--radius-sm)] border border-border bg-panel" />
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
