import { cn } from "@/components/ui/utils";
import {
	forwardRef,
	type InputHTMLAttributes,
	type ReactNode,
} from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	/** Optional field label text or node (styled in uppercase mono) */
	label?: ReactNode;
	/** Optional field error message. Sets borders to red and renders under the input */
	error?: string;
	/** Optional success state indicator. Sets borders to emerald */
	success?: boolean;
	/** Optional icon node placed inside the input (left-aligned) */
	leftIcon?: ReactNode;
	/** Optional icon node placed inside the input (right-aligned) */
	rightIcon?: ReactNode;
	/** Optional helper text rendered under the input when there is no validation error */
	helperText?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	function Input(
		{
			className,
			label,
			error,
			success,
			leftIcon,
			rightIcon,
			helperText,
			disabled,
			id,
			...rest
		},
		ref,
	) {
		const hasLeftIcon = !!leftIcon;
		const hasRightIcon = !!rightIcon;

		return (
			<div className="flex flex-col gap-1.5 w-full">
				{label && (
					<label
						htmlFor={id}
						className="text-[10px] font-mono font-semibold tracking-wider text-text-secondary uppercase select-none"
					>
						{label}
					</label>
				)}
				<div className="relative flex items-center w-full">
					{leftIcon && (
						<div className="absolute left-3.5 text-text-muted pointer-events-none flex items-center justify-center shrink-0">
							{leftIcon}
						</div>
					)}
					<input
						ref={ref}
						id={id}
						disabled={disabled}
						className={cn(
"flex w-full rounded-md border bg-surface text-sm text-text-bright placeholder:text-text-muted transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void",
							"h-11 py-2.5",
							hasLeftIcon ? "pl-10" : "px-3.5",
							hasRightIcon ? "pr-10" : "px-3.5",
							disabled ? "opacity-40 cursor-not-allowed bg-surface-elevated" : "hover:border-border-hi",
							error
								? "border-error/50 focus:border-error focus:ring-1 focus:ring-error"
								: success
									? "border-success/50 focus:border-success focus:ring-1 focus:ring-success"
									: "border-border focus:border-accent focus:ring-1 focus:ring-accent",
							className,
						)}
						{...rest}
					/>
					{rightIcon && (
						<div className="absolute right-3.5 text-text-muted pointer-events-none flex items-center justify-center shrink-0">
							{rightIcon}
						</div>
					)}
				</div>
				{(error || helperText) && (
					<div className="flex flex-col gap-0.5 select-none px-1">
						{error && (
							<span role="alert" className="text-[11px] font-medium text-error leading-normal">
								{error}
							</span>
						)}
						{helperText && !error && (
							<span className="text-[11px] text-text-muted leading-normal">
								{helperText}
							</span>
						)}
					</div>
				)}
			</div>
		);
	},
);
