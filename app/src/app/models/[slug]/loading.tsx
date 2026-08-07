export default function ModelDetailLoading() {
	return (
		<div className="min-h-dvh bg-void px-4 py-8 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-4xl animate-pulse space-y-6">
				<div className="h-8 w-48 bg-surface rounded-[var(--radius-sm)]" />
				<div className="h-6 w-32 bg-surface rounded-[var(--radius-sm)]" />
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
					{[...Array(6)].map((_, i) => (
						<div
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
