export default function ModelDetailLoading() {
	return (
		<div className="container-page py-10 sm:py-14" role="status" aria-label="Loading model details">
			<div className="animate-pulse space-y-6">
				<div className="h-8 w-48 bg-surface rounded-[var(--radius-sm)]" />
				<div className="h-6 w-32 bg-surface rounded-[var(--radius-sm)]" />
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					{[...Array(3)].map((_, i) => (
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
