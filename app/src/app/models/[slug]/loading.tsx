export default function ModelDetailLoading() {
	return (
		// Matches the model-detail page (max-w-5xl) so route entry doesn't
		// flash a narrower 4xl chrome before the detail arrives.
		<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
			<div className="animate-pulse space-y-6">
				<div className="h-8 w-48 bg-surface rounded-[var(--radius-sm)]" />
				<div className="h-6 w-32 bg-surface rounded-[var(--radius-sm)]" />
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
					{[...Array(6)].map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: skeleton grid
							key={i}
							className="h-24 border border-border bg-panel rounded-[var(--radius-sm)]"
						/>
					))}
				</div>
				<div className="h-40 w-full border border-border bg-panel rounded-[var(--radius-sm)]" />
			</div>
		</div>
	);
}
