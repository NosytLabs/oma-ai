/**
	* Unified dashboard card surface.
	*
	* Single source of truth for the radius/shadow/padding/accent-strip every
	* panel on /dashboard renders. Keeps the overview row visually in lockstep
	* (no more xl-vs-lg radii mixing, no more md-vs-sm shadows) so toggling
	* the metric tabs reads as one surface, not four.
	*
	* Use instead of hand-rolled divs with `bg-surface/30 border border-border`
	* in DashboardGrid and friends. The accent strip colors match the legacy
	* card categories:
	*   - accent (default): Credit balance, Auto-reload
	*   - success:          Credit balance (settled green)
	*   - info:             Today / system health / stats
	*   - warn:             Errors / uptime degradation
	*   - none:             No strip — for tables / dialogs / inner sections
	*/
import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

export type DashboardCardTone = "accent" | "success" | "info" | "warn" | "none";

interface DashboardCardProps {
	/** Strip + hover color tone. */
	tone?: DashboardCardTone;
	/** Optional title block — use one of the two layouts below. */
	title?: ReactNode;
	hint?: ReactNode;
	icon?: ReactNode;
	/** Right-aligned accessory rendered next to the title (badge, icon, button). */
	trailing?: ReactNode;
	className?: string;
	children: ReactNode;
	/** Removes the default min-height so callers can opt out of the row rhythm. */
	flush?: boolean;
}

const TONE_STRIP: Record<Exclude<DashboardCardTone, "none">, string> = {
	accent:
		"bg-gradient-to-r from-accent/40 via-accent/20 to-transparent",
	success:
		"bg-gradient-to-r from-success/40 via-success/20 to-transparent",
	info: "bg-gradient-to-r from-info/40 via-info/20 to-transparent",
	warn: "bg-gradient-to-r from-warning/40 via-warning/20 to-transparent",
};

export function DashboardCard({
	tone = "none",
	title,
	hint,
	icon,
	trailing,
	className,
	children,
	flush = false,
}: DashboardCardProps) {
	const strip = tone !== "none" ? TONE_STRIP[tone] : null;
	const hasHeader = title !== undefined || hint !== undefined || icon !== undefined;
	return (
		<div
			className={cn(
				"flex flex-col rounded-[var(--radius-xl)] border border-border bg-surface/30 shadow-[var(--shadow-md)] relative overflow-hidden transition-colors duration-200 ease-out hover:border-accent/40",
				!flush && "min-h-[12rem] h-full",
				className,
			)}
		>
			{strip && (
				<div
					aria-hidden="true"
					className={cn(
						"pointer-events-none absolute inset-x-0 top-0 h-1",
						strip,
					)}
				/>
			)}
			{hasHeader && (
				<div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
					<div className="min-w-0">
						{title && (
							<h2 className="font-sans text-[14.5px] font-bold text-text-bright tracking-tight">
								{title}
							</h2>
						)}
						{hint && (
							<p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-text-muted">
								{hint}
							</p>
						)}
					</div>
					<div className="flex shrink-0 items-start gap-2">
						{icon}
						{trailing}
					</div>
				</div>
			)}
			<div className={cn("flex flex-1 flex-col px-6", hasHeader ? "pb-6" : "py-6")}>
				{children}
			</div>
		</div>
	);
}

/** Convenience tone-only chip used in card trailing slots. */
export function DashboardCardChip({
	children,
	tone = "accent",
}: {
	children: ReactNode;
	tone?: "accent" | "neutral";
}) {
	return (
		<span
			className={cn(
				"rounded-[var(--radius-sm)] border px-2.5 py-1 text-[9.5px] font-mono font-bold uppercase tracking-wider shrink-0",
				tone === "accent"
					? "border-accent/30 bg-accent/10 text-accent shadow-[0_0_10px_-2px_var(--color-accent-glow)]"
					: "border-border bg-void text-text-muted",
			)}
		>
			{children}
		</span>
	);
}
