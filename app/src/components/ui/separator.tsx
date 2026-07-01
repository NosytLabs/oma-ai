import { cn } from "@/components/ui/utils";
import type { HTMLAttributes } from "react";

/**
 * Separator — 1px divider. Horizontal by default, vertical opt-in.
 * Color: --color-border-subtle so it never competes with content.
 */

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
	orientation?: "horizontal" | "vertical";
	decorative?: boolean;
}

export function Separator({
	orientation = "horizontal",
	decorative = true,
	className,
	...rest
}: SeparatorProps) {
	return (
		<div
			role={decorative ? "none" : "separator"}
			aria-orientation={decorative ? undefined : orientation}
			className={cn(
				"bg-border-subtle shrink-0",
				orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
				className,
			)}
			{...rest}
		/>
	);
}