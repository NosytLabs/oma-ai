import { cn } from "@/components/ui/utils";
import type { HTMLAttributes } from "react";

/**
 * Badge — small label primitive.
 * Variants map to semantic roles. Use sparingly — chips and tags
 * should not crowd a layout. Default `subtle` variant is the
 * workhorse; reserve `solid` for active states.
 */

export type BadgeVariant =
	| "subtle"
	| "accent"
	| "success"
	| "warning"
	| "outline"
	| "solid";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	variant?: BadgeVariant;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
	subtle: cn(
		"bg-[var(--color-surface-elevated)] text-text-secondary border border-border",
	),
	accent: cn(
		"bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-accent",
		"border border-[color-mix(in_srgb,var(--color-accent)_28%,transparent)]",
	),
	success: cn(
		"bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-success",
		"border border-[color-mix(in_srgb,var(--color-success)_30%,transparent)]",
	),
	warning: cn(
		"bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] text-warning",
		"border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)]",
	),
	outline: cn("bg-transparent text-text-secondary border border-border-bright"),
	solid: cn("bg-accent text-[var(--color-accent-fg)] border border-transparent"),
};

export function Badge({
	variant = "subtle",
	className,
	...rest
}: BadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
				"text-xs font-medium font-mono tracking-wide",
				"transition-colors duration-200",
				VARIANT_STYLES[variant],
				className,
			)}
			{...rest}
		/>
	);
}