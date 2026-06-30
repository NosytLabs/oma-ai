export default function Loading() {
	return (
		<div
			role="status"
			aria-live="polite"
			aria-busy="true"
			aria-label="Loading About page"
			className="mx-auto max-w-6xl px-4 py-12 sm:py-20 animate-pulse"
		>
			<div className="h-8 w-48 bg-surface rounded-lg mb-8" />
			<div className="space-y-4">
				<div className="h-4 bg-surface rounded w-3/4" />
				<div className="h-4 bg-surface rounded w-1/2" />
				<div className="h-4 bg-surface rounded w-5/6" />
			</div>
			<div className="mt-12 grid gap-6 md:grid-cols-2">
				<div className="h-40 bg-surface rounded-xl" />
				<div className="h-40 bg-surface rounded-xl" />
			</div>
		</div>
	);
}
