// ponytail: shared accordion item component
"use client";

import { m } from "framer-motion";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { useState } from "react";

interface AccordionItemProps {
	title: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
	/** Controlled open state — when provided, internal state is bypassed */
	isOpen?: boolean;
	/** Controlled toggle callback — required when isOpen is provided */
	onToggle?: () => void;
	/** Unique id prefix for a11y (button + panel ids) */
	id?: string;
	className?: string;
	/** Custom icon rendered left of the title */
	icon?: LucideIcon;
	/** Passthrough classes for the button element */
	buttonClassName?: string;
	/** Passthrough classes for the content panel wrapper */
	contentClassName?: string;
	/** Use CSS max-height transitions instead of framer-motion */
	cssTransition?: boolean;
}

export function AccordionItem({
	title,
	children,
	defaultOpen = false,
	isOpen: controlledOpen,
	onToggle,
	id,
	className = "",
	icon: Icon,
	buttonClassName = "",
	contentClassName = "",
	cssTransition = false,
}: AccordionItemProps) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);

	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : internalOpen;

	const handleToggle = () => {
		if (isControlled) {
			onToggle?.();
		} else {
			setInternalOpen(!internalOpen);
		}
	};

	const buttonId = id ? `${id}-button` : undefined;
	const panelId = id ? `${id}-panel` : undefined;

	const baseButtonClass =
		"flex w-full items-center justify-between gap-4 text-left transition-colors hover:bg-panel/60 focus-visible:outline-none focus-visible:bg-panel/60";
	const buttonPaddingClass = buttonClassName || "px-5 py-4";

	return (
		<div className={className}>
			<button
				id={buttonId}
				type="button"
				onClick={handleToggle}
				className={`${baseButtonClass} ${buttonPaddingClass}`}
				aria-expanded={open}
				aria-controls={panelId}
			>
				<span className="flex items-center gap-2 min-w-0">
					{Icon && <Icon className="h-4 w-4 shrink-0 text-accent" />}
					<span className="text-sm font-medium text-text-bright">{title}</span>
				</span>
				{cssTransition ? (
					<span
						className={`shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
					>
						<ChevronDown
							className="h-4 w-4 text-text-tertiary"
							aria-hidden="true"
						/>
					</span>
				) : (
					<m.span
						animate={{ rotate: open ? 180 : 0 }}
						transition={{ duration: 0.25, ease: "easeOut" as const }}
						className="shrink-0"
					>
						<ChevronDown
							className="h-4 w-4 text-text-tertiary"
							aria-hidden="true"
						/>
					</m.span>
				)}
			</button>
			{cssTransition ? (
				<div
					id={panelId}
					role="region"
					aria-labelledby={buttonId}
					className={`overflow-hidden transition-all duration-300 ${open ? "max-h-[600px]" : "max-h-0"}`}
				>
					<div
						className={`pb-4 text-xs sm:text-sm text-text-secondary leading-relaxed ${contentClassName || "px-5"}`}
					>
						{children}
					</div>
				</div>
			) : (
				<m.div
					id={panelId}
					role="region"
					aria-labelledby={buttonId}
					initial={false}
					animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
					transition={{ duration: 0.25, ease: "easeOut" as const }}
					className="overflow-hidden"
				>
					<div
						className={`pb-4 text-xs sm:text-sm text-text-secondary leading-relaxed ${contentClassName || "px-5"}`}
					>
						{children}
					</div>
				</m.div>
			)}
		</div>
	);
}
