"use client";

import { Slot } from "@/components/ui/slot";
import { cn } from "@/components/ui/utils";
import { Loader2 } from "lucide-react";
import {
	forwardRef,
	type ButtonHTMLAttributes,
	type ReactNode,
} from "react";

/**
 * Button — design-system primitive.
 * Five variants × four sizes, with optional icon, loading, and asChild support.
 * Button text NEVER wraps on desktop (`whitespace-nowrap` enforced).
 */

export type ButtonVariant =
	| "primary"
	| "secondary"
	| "ghost"
	| "outline"
	| "destructive";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	loading?: boolean;
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
	asChild?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
	primary: cn(
		"bg-accent text-[var(--color-accent-fg)] font-semibold",
		"hover:bg-[var(--color-accent-hover)] hover:shadow-[0_8px_24px_-8px_var(--color-accent-glow)]",
		"active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
		"shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-accent)_40%,transparent)]",
	),
	secondary: cn(
		"bg-[var(--color-surface-elevated)] text-text-primary border border-border",
		"hover:border-accent hover:text-accent hover:bg-[var(--color-surface)]",
		"active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
	),
	ghost: cn(
		"bg-transparent text-text-secondary",
		"hover:text-text-primary hover:bg-[var(--color-surface)]",
		"active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
	),
	outline: cn(
		"bg-transparent text-text-primary border border-border-bright",
		"hover:border-accent hover:text-accent",
		"active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
	),
	destructive: cn(
		"bg-[color-mix(in_srgb,var(--color-error)_15%,transparent)] text-error border border-[color-mix(in_srgb,var(--color-error)_30%,transparent)]",
		"hover:bg-[color-mix(in_srgb,var(--color-error)_22%,transparent)] hover:border-error",
		"active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
	),
};

const SIZE_STYLES: Record<ButtonSize, string> = {
	sm: "h-9 px-3 text-sm gap-1.5 rounded-[var(--radius-sm)]",
	md: "h-11 px-5 text-sm gap-2 rounded-[var(--radius-sm)]",
	lg: "h-12 px-6 text-base gap-2 rounded-[var(--radius-sm)]",
	icon: "h-10 w-10 rounded-[var(--radius-sm)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	function Button(
		{
			variant = "primary",
			size = "md",
			loading = false,
			leftIcon,
			rightIcon,
			asChild = false,
			className,
			children,
			disabled,
			type = "button",
			...rest
		},
		ref,
	) {
		const classes = cn(
			"inline-flex items-center justify-center",
			"font-sans whitespace-nowrap select-none",
			"transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-out",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
			"disabled:pointer-events-none",
			VARIANT_STYLES[variant],
			SIZE_STYLES[size],
			className,
		);

		const content = (
			<>
				{loading ? (
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
				) : (
					leftIcon
				)}
				{children}
				{!loading && rightIcon}
			</>
		);

		if (asChild) {
			return (
				<Slot ref={ref} className={classes}>
					{content}
				</Slot>
			);
		}

		return (
			<button
				ref={ref}
				type={type}
				className={classes}
				disabled={disabled || loading}
				{...rest}
			>
				{content}
			</button>
		);
	},
);