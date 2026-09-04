import { cn } from "@/components/ui/utils";

/**
 * Loading — homepage skeleton.
 * Keep the first paint geometrically aligned with the centered hero so the
 * route does not visibly jump when the interactive sections hydrate.
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
				<div className="flex min-h-[72dvh] flex-col items-center justify-center text-center">
					<div className="flex w-full max-w-4xl flex-col items-center gap-5">
						<div className="animate-shimmer bg-surface-elevated h-6 w-48 rounded-full" />
						<div className="animate-shimmer bg-surface-elevated h-14 w-full max-w-2xl rounded-[var(--radius-sm)] sm:h-20" />
						<div className="animate-shimmer bg-surface-elevated h-14 w-3/4 max-w-xl rounded-[var(--radius-sm)] sm:h-16" />
						<div className="mt-2 flex w-full max-w-2xl flex-col items-center gap-3">
							<div className="animate-shimmer bg-surface-elevated h-4 w-full rounded-[var(--radius-sm)]" />
							<div className="animate-shimmer bg-surface-elevated h-4 w-5/6 rounded-[var(--radius-sm)]" />
						</div>
						<div className="mt-6 flex w-full justify-center gap-3">
							<div className="animate-shimmer bg-surface-elevated h-12 w-36 rounded-[var(--radius-md)]" />
							<div className="animate-shimmer bg-surface-elevated h-12 w-28 rounded-[var(--radius-md)]" />
						</div>
					</div>

					<div className="mt-12 w-full max-w-[706px] overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface-elevated/60">
						<div className="flex items-center gap-2 border-b border-border px-4 py-3">
							<div className="animate-shimmer h-2.5 w-2.5 rounded-full bg-surface-elevated" />
							<div className="animate-shimmer h-2.5 w-2.5 rounded-full bg-surface-elevated" />
							<div className="animate-shimmer h-2.5 w-2.5 rounded-full bg-surface-elevated" />
							<div className="animate-shimmer ml-3 h-3 w-40 rounded-[var(--radius-sm)] bg-surface-elevated" />
						</div>
						<div className="flex flex-col gap-2.5 p-5">
							{Array.from({ length: 6 }).map((_, i) => (
								<div
									key={i}
									className={cn(
										"animate-shimmer h-3 rounded-[var(--radius-sm)] bg-surface-elevated",
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
