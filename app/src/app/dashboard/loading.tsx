export default function Loading() {
	return (
		// Matches the dashboard container (max-w-6xl via container-page) so
		// the route entry skeleton doesn't flash a wider 7xl chrome
		// before settling into the real layout.
		<div className="container-page py-10 sm:py-12">
			<div className="animate-pulse space-y-6">
				<div className="h-8 w-48 bg-surface" />
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{[...Array(4)].map((_, i) => (
						<div key={i} className="h-24 border border-border bg-panel" />
					))}
				</div>
				<div className="h-64 border border-border bg-panel" />
				<div className="h-96 border border-border bg-panel" />
			</div>
		</div>
	);
}
