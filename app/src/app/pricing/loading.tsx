export default function Loading() {
	return (
		<div className="min-h-dvh bg-void px-4 py-8 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-6xl animate-pulse space-y-6">
				<div className="h-10 w-48 bg-surface" />
				<div className="h-6 w-96 max-w-full bg-surface" />
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{[...Array(3)].map((_, i) => (
						<div key={i} className="h-48 border border-border bg-panel" />
					))}
				</div>
				<div className="h-96 border border-border bg-panel" />
			</div>
		</div>
	);
}
