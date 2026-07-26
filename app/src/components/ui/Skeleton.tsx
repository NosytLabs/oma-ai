import { cn } from "@/components/ui/utils";
import type { HTMLAttributes } from "react";

/**
 * Skeleton — shimmer placeholder.
 * `animate-shimmer` resolves via the `--animate-shimmer` token in globals.css
 * (@theme). The base background lives here so a Skeleton is visible even
 * where callers don't pass one.
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
				"animate-shimmer bg-surface-elevated rounded-[var(--radius-sm)]",
				shapeClassName,
				className,
			)}
			{...rest}
		/>
	);
}