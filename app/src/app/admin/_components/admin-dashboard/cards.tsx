"use client";

import {
	AlertTriangle,
	ArrowUpRight,
	CheckCircle2,
	XCircle,
} from "lucide-react";

export function StatCard({
	label,
	value,
	icon,
	trend,
}: {
	label: string;
	value: string;
	icon: React.ReactNode;
	trend?: string;
}) {
	return (
		<div className="rounded-lg border border-border bg-surface-elevated/30 p-4">
			<div className="mb-1 flex items-center justify-between text-xs text-text-muted">
				<span className="flex items-center gap-1.5 uppercase tracking-wide">
					{icon}
					{label}
				</span>
				{trend && <span className="font-mono">{trend}</span>}
			</div>
			<div className="text-2xl font-semibold">{value}</div>
		</div>
	);
}

export function IntegrationCard({
	name,
	icon,
	configured,
	health,
	notes,
}: {
	name: string;
	icon: React.ReactNode;
	configured: boolean;
	health?: "healthy" | "degraded" | "down";
	notes: string[];
}) {
	return (
		<div className="rounded-md border border-border bg-surface-elevated/30 p-3">
			<div className="mb-1.5 flex items-center justify-between">
				<span className="flex items-center gap-1.5 text-sm font-medium">
					{icon}
					{name}
				</span>
				{configured ? (
					health ? (
						<span
							className={`flex items-center gap-1 text-xs ${
								health === "healthy"
									? "text-accent"
									: health === "degraded"
										? "text-warning"
										: "text-error"
							}`}
						>
							{health === "healthy" ? (
								<CheckCircle2 className="h-3 w-3" />
							) : (
								<XCircle className="h-3 w-3" />
							)}
							{health}
						</span>
					) : (
						<span className="flex items-center gap-1 text-xs text-accent">
							<CheckCircle2 className="h-3 w-3" /> configured
						</span>
					)
				) : (
					<span className="flex items-center gap-1 text-xs text-text-muted">
						<AlertTriangle className="h-3 w-3" /> not configured
					</span>
				)}
			</div>
			<ul className="space-y-0.5 text-xs text-text-muted">
				{notes.map((n, i) => (
					<li key={i} className="flex items-start gap-1">
						<ArrowUpRight className="mt-0.5 h-2.5 w-2.5 flex-none text-text-muted/50" />
						<span>{n}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
