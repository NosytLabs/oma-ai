import { cn } from "@/components/ui/utils";

/**
 * Loading — homepage skeleton.
 * Mirrors the revamped hero (copy column + request card).
 */

export default function Loading() {
	return (
		<div
			role="status"
			aria-live="polite"
			aria-busy="true"
			aria-label="Loading OMA homepage"
			className="min-h-[100dvh] pt-8 pb-16"
		>
			<div className="container-page">
				<div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 items-center min-h-[60dvh]">
					<div className="flex flex-col items-start gap-5">
						<div className="animate-shimmer bg-surface-elevated h-6 w-48 rounded-full" />
						<div className="animate-shimmer bg-surface-elevated h-14 sm:h-20 w-full max-w-xl rounded-[var(--radius-sm)]" />
						<div className="animate-shimmer bg-surface-elevated h-14 sm:h-16 w-3/4 max-w-lg rounded-[var(--radius-sm)]" />
						<div className="mt-2 flex flex-col gap-3 w-full max-w-md">
							<div className="animate-shimmer bg-surface-elevated h-4 w-full rounded-[var(--radius-sm)]" />
							<div className="animate-shimmer bg-surface-elevated h-4 w-5/6 rounded-[var(--radius-sm)]" />
						</div>
						<div className="mt-6 flex gap-3">
							<div className="animate-shimmer bg-surface-elevated h-12 w-36 rounded-[var(--radius-md)]" />
							<div className="animate-shimmer bg-surface-elevated h-12 w-28 rounded-[var(--radius-md)]" />
						</div>
					</div>

					<div className="rounded-[var(--radius-xl)] border border-border bg-surface-elevated/60 overflow-hidden">
						<div className="flex items-center gap-2 px-4 py-3 border-b border-border">
							<div className="animate-shimmer bg-surface-elevated h-2.5 w-2.5 rounded-full" />
							<div className="animate-shimmer bg-surface-elevated h-2.5 w-2.5 rounded-full" />
							<div className="animate-shimmer bg-surface-elevated h-2.5 w-2.5 rounded-full" />
							<div className="animate-shimmer bg-surface-elevated ml-3 h-3 w-40 rounded-[var(--radius-sm)]" />
						</div>
						<div className="p-5 flex flex-col gap-2.5">
							{Array.from({ length: 6 }).map((_, i) => (
								<div
									key={i}
									className={cn(
										"animate-shimmer h-3 rounded-[var(--radius-sm)]",
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
