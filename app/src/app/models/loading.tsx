export default function Loading() {
	return (
		// `container-page` (max-w-6xl) matches the real /models page so
		// route entry doesn't flash a wider 7xl skeleton before the cards
		// settle into their 6xl grid.
		<div className="container-page py-10 sm:py-12">
			<div className="animate-pulse space-y-6">
				<div className="h-8 w-32 bg-surface" />
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{[...Array(8)].map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: skeleton grid
						<div key={i} className="h-32 border border-border bg-panel" />
					))}
				</div>
			</div>
		</div>
	);
}
