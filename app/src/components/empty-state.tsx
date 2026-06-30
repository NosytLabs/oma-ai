"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export type EmptyStateAction = {
	label: string;
	href?: string;
	onClick?: () => void;
};

export type EmptyStateProps = {
	icon: LucideIcon;
	title: string;
	description?: string;
	action?: EmptyStateAction;
	actions?: EmptyStateAction[];
	variant?: "default" | "table";
};

function EmptyStateActions({ actions }: { actions: EmptyStateAction[] }) {
	if (actions.length === 0) return null;

	return (
		<div className="mt-4 flex flex-wrap items-center justify-center gap-3">
			{actions.map((action, index) => {
				const baseClasses =
					"inline-flex items-center gap-2 rounded border border-border bg-surface px-4 py-2 font-mono text-sm text-text-secondary transition-colors hover:border-border-bright hover:text-text";

				if (action.href) {
					return (
						<Link
							key={`${action.label}-${index}`}
							href={action.href}
							className={baseClasses}
						>
							{action.label}
						</Link>
					);
				}

				return (
					<button
						key={`${action.label}-${index}`}
						type="button"
						onClick={action.onClick}
						className={baseClasses}
					>
						{action.label}
					</button>
				);
			})}
		</div>
	);
}

function EmptyStateContent({
	icon: Icon,
	title,
	description,
	action,
	actions,
}: Omit<EmptyStateProps, "variant">) {
	const allActions: EmptyStateAction[] = [];
	if (action) allActions.push(action);
	if (actions) allActions.push(...actions);

	return (
		<>
			<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-accent/30 bg-accent/10">
				<Icon className="h-6 w-6 text-accent" aria-hidden="true" />
			</div>
			<h2 className="font-mono text-lg font-bold text-text-bright">{title}</h2>
			{description && (
				<p className="mt-1 max-w-md font-mono text-sm text-text-muted">
					{description}
				</p>
			)}
			<EmptyStateActions actions={allActions} />
		</>
	);
}

export function EmptyState({ variant = "default", ...props }: EmptyStateProps) {
	if (variant === "table") {
		return <EmptyStateContent {...props} />;
	}

	return (
		<div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-8 text-center">
			<EmptyStateContent {...props} />
		</div>
	);
}
