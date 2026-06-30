export default function Loading() {
	return (
		<div className="min-h-dvh bg-void px-4 py-8 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-7xl animate-pulse space-y-6">
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
