export default function Loading() {
	return (
		// `container-page max-w-5xl` mirrors app/(dashboard)/settings so the
		// route entry doesn't flash a narrower skeleton before the real page
		// arrives. Same padding rhythm (`py-6 sm:py-8`).
		<div className="container-page max-w-5xl py-6 sm:py-8">
			<div className="animate-pulse space-y-6">
				<div className="h-8 w-32 bg-surface" />
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					<div className="border border-border bg-panel p-6 space-y-4">
						<div className="h-6 w-32 bg-surface" />
						<div className="space-y-3">
							<div className="h-4 w-full bg-surface" />
							<div className="h-4 w-3/4 bg-surface" />
							<div className="h-4 w-1/2 bg-surface" />
						</div>
					</div>
					<div className="border border-border bg-panel p-6 space-y-4">
						<div className="h-6 w-32 bg-surface" />
						<div className="space-y-3">
							<div className="h-4 w-full bg-surface" />
							<div className="h-4 w-3/4 bg-surface" />
							<div className="h-4 w-1/2 bg-surface" />
						</div>
					</div>
				</div>
				<div className="border border-border bg-panel p-6 space-y-4">
					<div className="h-6 w-40 bg-surface" />
					<div className="h-64 w-full bg-surface" />
				</div>
			</div>
		</div>
	);
}
