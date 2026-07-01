import { cn } from "@/components/ui/utils";

/**
 * Loading — homepage skeleton.
 * Mirrors the hero layout shape (asymmetric copy + terminal) so the
 * transition from skeleton to real content is invisible. Uses the
 * global .animate-shimmer keyframes defined in globals.css.
 */

export default function Loading() {
	return (
		<div
			role="status"
			aria-live="polite"
			aria-busy="true"
			aria-label="Loading OMA-AI homepage"
			className="min-h-[100dvh] pt-20 pb-24"
		>
			<div className="container-page">
				<div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center min-h-[60dvh]">
					{/* Left column skeleton */}
					<div className="flex flex-col items-start gap-5">
						<div className="animate-shimmer h-12 sm:h-16 w-3/4 rounded-[var(--radius-sm)]" />
						<div className="animate-shimmer h-12 sm:h-16 w-1/2 rounded-[var(--radius-sm)]" />
						<div className="mt-4 flex flex-col gap-3 w-full max-w-md">
							<div className="animate-shimmer h-4 w-full rounded" />
							<div className="animate-shimmer h-4 w-5/6 rounded" />
						</div>
						<div className="mt-6 flex gap-3">
							<div className="animate-shimmer h-12 w-36 rounded-[var(--radius-sm)]" />
							<div className="animate-shimmer h-12 w-32 rounded-[var(--radius-sm)]" />
						</div>
					</div>

					{/* Right column — terminal skeleton */}
					<div className="surface-code overflow-hidden border-border">
						<div className="flex items-center gap-2 px-4 py-3 border-b border-border">
							<div className="animate-shimmer h-2.5 w-2.5 rounded-full" />
							<div className="animate-shimmer h-2.5 w-2.5 rounded-full" />
							<div className="animate-shimmer h-2.5 w-2.5 rounded-full" />
							<div className="animate-shimmer ml-3 h-3 w-32 rounded" />
						</div>
						<div className="p-5 flex flex-col gap-2">
							{Array.from({ length: 6 }).map((_, i) => (
								<div
									key={i}
									className={cn(
										"animate-shimmer h-3 rounded",
										i === 0 ? "w-3/4" : i === 1 ? "w-5/6" : "w-2/3",
									)}
								/>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}