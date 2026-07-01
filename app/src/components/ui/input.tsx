"use client";

import { cn } from "@/components/ui/utils";
import { forwardRef, type InputHTMLAttributes, useId } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	invalid?: boolean;
	inputClassName?: string;
}

/**
 * Input — form text primitive.
 * Wraps the native input in a small div so we can render an
 * invalid border without conflicting with Tailwind utilities.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{ className, inputClassName, invalid = false, ...rest },
	ref,
) {
	return (
		<input
			ref={ref}
			aria-invalid={invalid || undefined}
			className={cn(
				"h-11 w-full rounded-[var(--radius-sm)] px-3.5",
				"bg-[var(--color-surface)] text-text-primary",
				"border transition-[border-color,box-shadow] duration-200",
				"placeholder:text-text-muted",
				"font-sans text-sm",
				invalid
					? "border-error focus-visible:ring-error"
					: "border-border focus-visible:border-accent focus-visible:ring-accent",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
				"disabled:opacity-50 disabled:cursor-not-allowed",
				className,
				inputClassName,
			)}
			{...rest}
		/>
	);
});

export interface InputFieldProps extends InputProps {
	label?: string;
	hint?: string;
	error?: string;
	wrapperClassName?: string;
}

export function InputField({
	label,
	hint,
	error,
	wrapperClassName,
	id,
	...inputProps
}: InputFieldProps) {
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
				<label
					htmlFor={fieldId}
					className="text-sm font-medium text-text-primary"
				>
					{label}
				</label>
			)}
			<Input
				id={fieldId}
				aria-describedby={describedBy}
				invalid={Boolean(error)}
				{...inputProps}
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