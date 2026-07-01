"use client";

import { cn } from "@/components/ui/utils";
import {
	forwardRef,
	type LabelHTMLAttributes,
	type TextareaHTMLAttributes,
	useId,
} from "react";

/**
 * Label — form label primitive. Pair with Input via `htmlFor`.
 * Optional `required` indicator renders an accent asterisk.
 */
export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
	required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
	{ className, required, children, ...rest },
	ref,
) {
	return (
		<label
			ref={ref}
			className={cn(
				"text-sm font-medium text-text-primary inline-flex items-center gap-1",
				className,
			)}
			{...rest}
		>
			{children}
			{required && (
				<span aria-hidden="true" className="text-accent">
					*
				</span>
			)}
		</label>
	);
});

export interface TextareaProps
	extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	function Textarea({ className, invalid = false, ...rest }, ref) {
		return (
			<textarea
				ref={ref}
				aria-invalid={invalid || undefined}
				className={cn(
					"min-h-[96px] w-full rounded-[var(--radius-sm)] px-3.5 py-3",
					"bg-[var(--color-surface)] text-text-primary resize-y",
					"border transition-[border-color,box-shadow] duration-200",
					"placeholder:text-text-muted",
					"font-sans text-sm leading-relaxed",
					invalid
						? "border-error focus-visible:ring-error"
						: "border-border focus-visible:border-accent focus-visible:ring-accent",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
					"disabled:opacity-50 disabled:cursor-not-allowed",
					className,
				)}
				{...rest}
			/>
		);
	},
);

export interface TextareaFieldProps extends TextareaProps {
	label?: string;
	hint?: string;
	error?: string;
	wrapperClassName?: string;
}

export function TextareaField({
	label,
	hint,
	error,
	wrapperClassName,
	id,
	...rest
}: TextareaFieldProps) {
	const reactId = useId();
	const fieldId = id ?? reactId;
	const describedBy = error
		? `${fieldId}-error`
		: hint
			? `${fieldId}-hint`
			: undefined;
	return (
		<div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
			{label && (
				<Label htmlFor={fieldId}>{label}</Label>
			)}
			<Textarea
				id={fieldId}
				aria-describedby={describedBy}
				invalid={Boolean(error)}
				{...rest}
			/>
			{error ? (
				<p
					id={`${fieldId}-error`}
					className="text-xs text-error font-mono"
				>
					{error}
				</p>
			) : hint ? (
				<p id={`${fieldId}-hint`} className="text-xs text-text-muted">
					{hint}
				</p>
			) : null}
		</div>
	);
}