import { cn } from "@/components/ui/utils";
import type { HTMLAttributes } from "react";

/**
 * Skeleton — shimmer placeholder.
 * Uses the global shimmer keyframes defined in globals.css
 * (.animate-shimmer) so timing matches existing motion budget.
 */

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
	/** Tailwind-friendly class to override shape (e.g. "h-4 w-32 rounded-full") */
	shapeClassName?: string;
}

export function Skeleton({
	className,
	shapeClassName,
	...rest
}: SkeletonProps) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"animate-shimmer rounded-[var(--radius-sm)]",
				shapeClassName,
				className,
			)}
			{...rest}
		/>
	);
}