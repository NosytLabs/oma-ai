"use client";

import { cn } from "@/components/ui/utils";
import { Slot } from "@/components/ui/slot";
import {
	forwardRef,
	type ButtonHTMLAttributes,
	type ReactNode,
} from "react";

/**
 * IconButton — square touch target with icon-only content.
 * Same variant system as Button but `size` always resolves to
 * a fixed square (icon- sm/md/lg). Use sparingly — every icon
 * button needs an aria-label or sr-only label.
 */

export type IconButtonVariant =
	| "primary"
	| "secondary"
	| "ghost"
	| "outline";

export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: IconButtonVariant;
	size?: IconButtonSize;
	"aria-label": string;
	asChild?: boolean;
	children: ReactNode;
}

const VARIANT_STYLES: Record<IconButtonVariant, string> = {
	primary: cn(
		"bg-accent text-[var(--color-accent-fg)]",
		"hover:bg-[var(--color-accent-hover)]",
		"active:scale-[0.96] disabled:opacity-50",
	),
	secondary: cn(
		"bg-[var(--color-surface-elevated)] text-text-primary border border-border",
		"hover:border-accent hover:text-accent",
		"active:scale-[0.96] disabled:opacity-50",
	),
	ghost: cn(
		"bg-transparent text-text-secondary",
		"hover:text-text-primary hover:bg-[var(--color-surface)]",
		"active:scale-[0.96] disabled:opacity-50",
	),
	outline: cn(
		"bg-transparent text-text-primary border border-border-bright",
		"hover:border-accent hover:text-accent",
		"active:scale-[0.96] disabled:opacity-50",
	),
};

const SIZE_STYLES: Record<IconButtonSize, string> = {
	sm: "h-9 w-9 [&_svg]:h-4 [&_svg]:w-4",
	md: "h-10 w-10 [&_svg]:h-5 [&_svg]:w-5",
	lg: "h-12 w-12 [&_svg]:h-6 [&_svg]:w-6",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
	function IconButton(
		{
			variant = "ghost",
			size = "md",
			asChild = false,
			className,
			children,
			type = "button",
			...rest
		},
		ref,
	) {
		const classes = cn(
			"inline-flex items-center justify-center shrink-0",
			"rounded-[var(--radius-sm)]",
			"transition-[background-color,border-color,color,transform] duration-200 ease-out",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
			"disabled:pointer-events-none",
			VARIANT_STYLES[variant],
			SIZE_STYLES[size],
			className,
		);

		if (asChild) {
			return (
				<Slot ref={ref} className={classes}>
					{children}
				</Slot>
			);
		}

		return (
			<button ref={ref} type={type} className={classes} {...rest}>
				{children}
			</button>
		);
	},
);