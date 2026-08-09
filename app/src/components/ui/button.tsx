"use client";

import { Slot } from "@/components/ui/slot";
import { cn } from "@/components/ui/utils";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * Button — design-system primitive.
 * Five variants × four sizes, with optional icon, loading, and asChild support.
 * Button text NEVER wraps on desktop (`whitespace-nowrap` enforced).
 */

type ButtonVariant =
 "primary" | "secondary" | "ghost" | "outline" | "destructive";
type ButtonSize = "sm" | "md" | "lg" | "icon";

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
	"btn-primary border border-[color-mix(in_srgb,var(--color-accent)_45%,transparent)]",
	"bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-hover))] text-[var(--color-accent-fg)] font-semibold",
	" hover:shadow-[0_14px_30px_-10px_var(--color-accent-glow)] hover:brightness-105 hover:-translate-y-0.5",
	"active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none",
	"shadow-[0_10px_26px_-16px_var(--color-accent-glow)]",
 ),
 secondary: cn(
	"btn-secondary bg-[color-mix(in_srgb,var(--color-surface-elevated)_90%,transparent)] text-text-primary border border-[color-mix(in_srgb,var(--color-border-bright)_48%,var(--color-border))]",
	" hover:border-accent hover:text-accent hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] hover:shadow-[0_12px_28px_-18px_rgba(70,211,154,0.3)] hover:-translate-y-0.5",
	"active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none",
 ),
 ghost: cn(
	"bg-transparent text-text-secondary transition-[background-color,color,transform,opacity]",
	"hover:text-text-primary hover:bg-[var(--color-surface)]",
	"active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed",
 ),
 outline: cn(
	"bg-transparent text-text-primary border border-border-bright",
	" hover:border-accent hover:text-accent hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] hover:shadow-[0_8px_20px_-10px_rgba(70,211,154,0.25)] hover:-translate-y-0.5",
	"active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none",
 ),
 destructive: cn(
	"bg-[color-mix(in_srgb,var(--color-error)_15%,transparent)] text-error border border-[color-mix(in_srgb,var(--color-error)_30%,transparent)]",
	"hover:bg-[color-mix(in_srgb,var(--color-error)_22%,transparent)] hover:border-error hover:shadow-[0_8px_20px_-10px_rgba(248,113,113,0.3)]",
	"active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none",
 ),
};

const SIZE_STYLES: Record<ButtonSize, string> = {
 sm: "h-10 px-3.5 text-sm gap-1.5 rounded-[var(--radius-sm)]",
 md: "h-11 px-5.5 text-sm gap-2 rounded-[var(--radius-sm)]",
 lg: "h-12 px-6.5 text-base gap-2 rounded-[var(--radius-sm)]",
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
 "font-sans whitespace-nowrap select-none tracking-[-0.01em]",
 "transition-[background-color,border-color,box-shadow,color,transform,opacity] duration-200 ease-out",
 "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void",

 "disabled:pointer-events-none",
 VARIANT_STYLES[variant],
 SIZE_STYLES[size],
 className,
 );

 const innerContent = (
 <>
 {loading ? (
 <Loader2
 className="h-4 w-4 animate-spin shrink-0"
 aria-hidden="true"
 />
 ) : (
 leftIcon
 )}
 <span
 className={cn(
 "transition-opacity duration-200",
 loading && "opacity-80",
 )}
 >
 {children}
 </span>
 {!loading && rightIcon}
 </>
 );

 if (asChild) {
 return (
 <Slot ref={ref} className={classes}>
 <span className="relative z-10 inline-flex items-center gap-[inherit] justify-center w-full h-full pointer-events-none">
 {innerContent}
 </span>
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
 <span className="relative z-10 inline-flex items-center gap-[inherit] justify-center w-full h-full pointer-events-none">
 {innerContent}
 </span>
 </button>
 );
 },
);
