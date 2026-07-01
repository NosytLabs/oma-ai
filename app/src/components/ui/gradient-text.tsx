import { cn } from "@/components/ui/utils";
import type { HTMLAttributes } from "react";

/**
 * GradientText — animated accent gradient text.
 * Falls back to a flat accent color when the user prefers
 * reduced motion (handled by globals.css `@media` rule).
 */

export interface GradientTextProps extends HTMLAttributes<HTMLSpanElement> {
	as?: "span" | "h1" | "h2" | "h3" | "p";
}

export function GradientText({
	className,
	as: Tag = "span",
	children,
	...rest
}: GradientTextProps) {
	return (
		<Tag
			className={cn("gradient-text-accent inline-block", className)}
			{...rest}
		>
			{children}
		</Tag>
	);
}