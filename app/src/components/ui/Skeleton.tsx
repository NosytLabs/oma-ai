import { cn } from "@/components/ui/utils";
import type { HTMLAttributes } from "react";

/**
	* Skeleton — shimmer or pulse placeholder.
	* Supports rendering staggered multi-line text representations,
	* multiple animation types (shimmer sweep, pulse breathing, static),
	* and accessibility considerations.
	*/

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
	/** Tailwind-friendly class to override shape (e.g. "h-4 w-32 rounded-full") */
	shapeClassName?: string;
	/** Number of text-like lines to render (staggered widths for paragraph look) */
	lines?: number;
	/** Animation variant style */
	variant?: "shimmer" | "pulse" | "static";
}

export function Skeleton({
	className,
	shapeClassName,
	lines = 1,
	variant = "shimmer",
	...rest
}: SkeletonProps) {
	const animationClass = {
		shimmer: "skeleton-sweep",
		pulse: "animate-pulse bg-[var(--color-surface-elevated)]",
		static: "bg-[var(--color-surface-elevated)]",
	}[variant];

	if (lines > 1) {
		return (
			<div
				role="status"
				aria-busy="true"
				aria-label="Loading"
				className={cn("flex flex-col gap-2.5 w-full", className)}
				{...rest}
			>
				{Array.from({ length: lines }).map((_, index) => {
					const isLast = index === lines - 1;
					// If there's 3+ lines, make the middle/second-to-last lines vary slightly too
					let widthClass = "w-full";
					if (isLast) {
						widthClass = "w-[75%]";
					} else if (index === 1 && lines > 2) {
						widthClass = "w-[92%]";
					}

					return (
						<div
							key={index}
							className={cn(
								"h-3.5 rounded-[var(--radius-sm)]",
								animationClass,
								widthClass,
								shapeClassName,
							)}
						/>
					);
				})}
			</div>
		);
	}

	return (
		<div
			role="status"
			aria-busy="true"
			aria-label="Loading"
			className={cn(
				"rounded-[var(--radius-sm)]",
				animationClass,
				shapeClassName,
				className,
			)}
			{...rest}
		/>
	);
}
