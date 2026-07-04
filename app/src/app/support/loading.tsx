import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
	return (
		<div
			role="status"
			aria-label="Loading support"
			className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 animate-pulse"
		>
			<Skeleton className="h-3 w-20 mb-3" />
			<Skeleton className="h-10 w-64 mb-3" />
			<Skeleton className="h-4 w-1/2 mb-10" />
			<div className="grid gap-4 sm:grid-cols-2 mb-8">
				{[...Array(4)].map((_, i) => (
					<div
						key={i}
						className="rounded-xl border border-border/50 bg-surface p-5 space-y-2"
					>
						<Skeleton className="h-4 w-2/3" />
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-4/5" />
					</div>
				))}
			</div>
			<div className="border border-border bg-surface p-5 sm:p-6 space-y-4 max-w-2xl">
				<Skeleton className="h-3 w-20" />
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-9 w-full" />
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-9 w-32" />
			</div>
		</div>
	);
}
