import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

interface SettingsCardProps {
	/** Icon shown in the card title row. Decorative — supply aria-hidden. */
	icon?: ReactNode;
	/** Small uppercase title above the body. */
	title: string;
	/** Optional description under the title. */
	description?: string;
	/** Layout: `panel` (default, primary surface) or `stat` (lighter stat tile). */
	variant?: "panel" | "stat";
	/** Action area on the right side of the title row. */
	action?: ReactNode;
	/** Card body. */
	children?: ReactNode;
	className?: string;
}

/**
	* SettingsCard — single source of truth for the chrome of a settings
	* panel. Used across Profile / Appearance / Privacy / Danger Zone. Two
	* variants cover the only two layouts we actually need: a primary
	* panel (`bg-surface/30`) and a smaller stat tile (`bg-surface/50`,
	* used for the three-column grid in ProfileSection).
	*
	* Title row is `flex items-center gap-2 text-sm font-semibold
	* text-text-bright`. Description is `mt-1 text-xs text-text-muted`.
	* Body slots in below with `mt-3`. The whole card lifts subtly on
	* hover (border-accent/40, bg-surface) so it feels live.
	*/
export function SettingsCard({
	icon,
	title,
	description,
	variant = "panel",
	action,
	children,
	className,
}: SettingsCardProps) {
	const isStat = variant === "stat";
	return (
		<div
			className={cn(
				"rounded-[var(--radius-md)] border border-border p-5 transition-[border-color,background-color,transform] duration-200 ease-out hover:border-accent/40",
				isStat
					? "bg-surface/50 hover:bg-surface hover:scale-[1.01]"
					: "bg-surface/30",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2 text-sm font-semibold text-text-bright">
						{icon}
						{title}
					</div>
					{description && (
						<p className="mt-1 text-xs text-text-muted">{description}</p>
					)}
				</div>
				{action && <div className="shrink-0">{action}</div>}
			</div>
			{children && <div className="mt-4">{children}</div>}
		</div>
	);
}
