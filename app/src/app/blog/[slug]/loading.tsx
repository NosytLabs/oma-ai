export default function Loading() {
	return (
		<div
			role="status"
			aria-live="polite"
			aria-busy="true"
			aria-label="Loading blog post"
			className="mx-auto max-w-3xl px-4 py-12 sm:py-20 animate-pulse"
		>
			<div className="h-4 w-24 bg-surface rounded mb-4" />
			<div className="h-10 w-3/4 bg-surface rounded-lg mb-6" />
			<div className="h-4 w-1/2 bg-surface rounded mb-12" />
			<div className="space-y-4">
				<div className="h-4 bg-surface rounded w-full" />
				<div className="h-4 bg-surface rounded w-5/6" />
				<div className="h-4 bg-surface rounded w-4/6" />
				<div className="h-4 bg-surface rounded w-full" />
				<div className="h-4 bg-surface rounded w-3/4" />
			</div>
		</div>
	);
}
