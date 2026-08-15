import { cn } from "@/components/ui/utils";
import type { HTMLAttributes, KeyboardEvent, MouseEvent } from "react";

/**
	* Badge — small label primitive.
	* Variants map to semantic roles. Use sparingly — chips and tags
	* should not crowd a layout. Default `subtle` variant is the
	* workhorse; reserve `solid` for active states.
	*/

type BadgeVariant =
	"subtle" | "accent" | "success" | "warning" | "outline" | "solid";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	variant?: BadgeVariant;
	showDot?: boolean;
	pulseDot?: boolean;
	interactive?: boolean;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
	subtle: cn(
	"bg-[var(--color-surface-elevated)] text-text-secondary border border-border",
	),
	accent: cn(
	"bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent)]",
	"border border-[color-mix(in_srgb,var(--color-accent)_28%,transparent)]",
	),
	success: cn(
	"bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--color-success)]",
	"border border-[color-mix(in_srgb,var(--color-success)_30%,transparent)]",
	),
	warning: cn(
	"bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] text-[var(--color-warning)]",
	"border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)]",
	),
	outline: cn("bg-transparent text-text-secondary border border-border-bright"),
	solid: cn(
	"bg-accent text-[var(--color-accent-fg)] border border-transparent",
	),
};

export function Badge({
	variant = "subtle",
	showDot,
	pulseDot = false,
	interactive = false,
	className,
	children,
	...rest
}: BadgeProps) {
	const shouldShowDot =
	showDot ?? ["accent", "success", "warning"].includes(variant);
	const isInteractive = interactive || !!rest.onClick;

	const dotColors: Record<BadgeVariant, string> = {
	subtle: "bg-text-muted/60",
	accent: "bg-[var(--color-accent)]",
	success: "bg-[var(--color-success)]",
	warning: "bg-[var(--color-warning)]",
	outline: "bg-text-secondary/50",
	solid: "bg-[var(--color-void)]",
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
	if (isInteractive && (e.key === "Enter" || e.key === " ")) {
	e.preventDefault();
	const clickEvent = e as unknown as MouseEvent<HTMLSpanElement>;
	rest.onClick?.(clickEvent);
	}
	};

	return (
	<span
	className={cn(
	"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
	"text-xs font-medium font-mono tracking-wide select-none",
	"transition-[background-color,border-color,color,transform,box-shadow,opacity] duration-200 ease-out",
	VARIANT_STYLES[variant],
	isInteractive && [
	"cursor-pointer hover:brightness-110",
	"hover:shadow-[0_4px_12px_rgba(70,211,154,0.15)]",
	"active:scale-[0.97] active:translate-y-0",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-void",
	],
	className,
	)}
	role={isInteractive ? "button" : undefined}
	tabIndex={isInteractive ? 0 : undefined}
	onKeyDown={handleKeyDown}
	{...rest}
	>
	{shouldShowDot && (
	<span className="relative flex h-1.5 w-1.5 shrink-0">
	{(pulseDot || ["success", "accent"].includes(variant)) && (
	<span
	className={cn(
	"absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
	variant === "success" && "bg-[var(--color-success)]",
	variant === "accent" && "bg-[var(--color-accent)]",
	variant === "warning" && "bg-[var(--color-warning)]",
	variant === "subtle" && "bg-text-muted",
	variant === "outline" && "bg-text-secondary",
	variant === "solid" && "bg-[var(--color-void)]",
	)}
	/>
	)}
	<span
	className={cn(
	"relative inline-flex rounded-full h-1.5 w-1.5",
	dotColors[variant],
	)}
	/>
	</span>
	)}
	{children}
	</span>
	);
}
