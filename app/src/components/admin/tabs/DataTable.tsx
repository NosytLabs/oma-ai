"use client";

import type { ReactNode } from "react";

type DataTableProps = {
	title?: string;
	children: ReactNode;
};

export function DataTable({ title, children }: DataTableProps) {
	return (
		<div className="rounded border border-border bg-surface overflow-hidden">
			{title && (
				<div className="px-4 py-3 border-b border-border bg-panel">
					<h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
						{title}
					</h3>
				</div>
			)}
			<div className="overflow-x-auto">{children}</div>
		</div>
	);
}
