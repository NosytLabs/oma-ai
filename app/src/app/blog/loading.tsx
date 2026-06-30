export default function Loading() {
	return (
		<div
			role="status"
			aria-live="polite"
			aria-busy="true"
			aria-label="Loading Blog posts"
			className="mx-auto max-w-6xl px-4 py-12 sm:py-20 animate-pulse"
		>
			<div className="h-10 w-64 bg-surface rounded-lg mb-12" />
			<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<div
						key={i}
						className="rounded-xl border border-border bg-surface overflow-hidden"
					>
						<div className="h-48 bg-panel" />
						<div className="p-5 space-y-3">
							<div className="h-3 w-20 bg-panel rounded" />
							<div className="h-5 w-3/4 bg-panel rounded" />
							<div className="h-4 w-full bg-panel rounded" />
							<div className="h-4 w-1/2 bg-panel rounded" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
