import { cn } from "@/components/ui/utils";
import { forwardRef, type HTMLAttributes } from "react";

/**
 * Card — surface primitive.
 * Use the sub-components (CardHeader, CardTitle, etc.) for consistent
 * internal padding and spacing. Hover lift is opt-in via the `interactive`
 * prop so non-interactive cards stay static.
 */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
	interactive?: boolean;
	as?: "div" | "article" | "section";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
	{ className, interactive = false, as: Tag = "div", ...rest },
	ref,
) {
	return (
		<Tag
			ref={ref}
			className={cn(
				"surface-card",
				"p-6 sm:p-7",
				interactive &&
					"cursor-pointer hover:-translate-y-0.5 active:translate-y-0",
				className,
			)}
			{...rest}
		/>
	);
});

export const CardHeader = forwardRef<
	HTMLDivElement,
	HTMLAttributes<HTMLDivElement>
>(function CardHeader({ className, ...rest }, ref) {
	return (
		<div
			ref={ref}
			className={cn("flex flex-col gap-1.5 pb-4", className)}
			{...rest}
		/>
	);
});

export const CardTitle = forwardRef<
	HTMLHeadingElement,
	HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, ...rest }, ref) {
	return (
		<h3
			ref={ref}
			className={cn(
				"font-heading text-lg font-semibold tracking-tight text-text-bright",
				className,
			)}
			{...rest}
		/>
	);
});

export const CardDescription = forwardRef<
	HTMLParagraphElement,
	HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...rest }, ref) {
	return (
		<p
			ref={ref}
			className={cn("text-sm text-text-secondary leading-relaxed", className)}
			{...rest}
		/>
	);
});

export const CardContent = forwardRef<
	HTMLDivElement,
	HTMLAttributes<HTMLDivElement>
>(function CardContent({ className, ...rest }, ref) {
	return (
		<div ref={ref} className={cn("text-sm", className)} {...rest} />
	);
});

export const CardFooter = forwardRef<
	HTMLDivElement,
	HTMLAttributes<HTMLDivElement>
>(function CardFooter({ className, ...rest }, ref) {
	return (
		<div
			ref={ref}
			className={cn(
				"flex items-center gap-3 pt-4 mt-4 border-t border-border-subtle",
				className,
			)}
			{...rest}
		/>
	);
});