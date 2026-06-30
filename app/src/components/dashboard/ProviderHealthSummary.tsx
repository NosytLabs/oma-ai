"use client";

import { Activity, ArrowUpRight } from "lucide-react";
import { useHealthQuery } from "@/app/dashboard/_hooks/useHealthQuery";
import { formatTime } from "@/lib/utils";
import { type CheckStatus, TONE_DOT, TONE_TEXT, toneFor } from "./healthTone";

/**
 * Compact "provider health" summary for the dashboard overview.
 * Shows a status pill + count of OK/degraded/circuit-open providers and a
 * "View all" link to the Health tab. Shares the /health polling stream with
 * ProviderHealthCard via TanStack queryKey dedup.
 */
export function ProviderHealthSummary() {
	const { data, dataUpdatedAt } = useHealthQuery();

	if (!data?.checks) {
		return (
			<div className="flex flex-col p-6 bg-void">
				<div className="mb-6 flex items-start justify-between">
					<div>
						<h2 className="text-sm font-semibold text-text-bright">
							Providers
						</h2>
						<p className="mt-0.5 text-[11px] text-text-muted">
							Live health across all routes
						</p>
					</div>
					<div className="flex h-8 w-8 items-center justify-center border border-accent/20 bg-accent/10 text-accent">
						<Activity className="h-3.5 w-3.5" aria-hidden="true" />
					</div>
				</div>
				<div className="flex-1 flex items-center gap-2 py-2 text-xs text-text-muted">
					<span className="inline-block h-1.5 w-1.5 rounded-full bg-text-muted animate-pulse" />
					Polling providers…
				</div>
			</div>
		);
	}

	const entries = Object.entries(data.checks);
	const counts = { green: 0, yellow: 0, orange: 0, red: 0 };
	for (const [, raw] of entries) {
		const status = ((raw as { status?: CheckStatus })?.status ??
			"outage") as CheckStatus;
		counts[toneFor(status)] += 1;
	}
	const overallTone =
		counts.red > 0
			? "red"
			: counts.orange > 0
				? "orange"
				: counts.yellow > 0
					? "yellow"
					: "green";
	const overallLabel =
		overallTone === "green"
			? "All operational"
			: overallTone === "yellow"
				? "Degraded"
				: overallTone === "orange"
					? "Rate limited"
					: "Outage detected";

	return (
		<div className="flex flex-col p-6 bg-void">
			<div className="mb-6 flex items-start justify-between">
				<div>
					<h2 className="text-sm font-semibold text-text-bright">Providers</h2>
					<p className="mt-0.5 text-[11px] text-text-muted">
						Live health across all routes
					</p>
				</div>
				<div
					className={`flex h-8 w-8 items-center justify-center border ${overallTone === "green" ? "border-success/20 bg-success/10" : overallTone === "red" ? "border-pink/20 bg-pink/10" : "border-warning/20 bg-warning/10"} ${TONE_TEXT[overallTone]}`}
				>
					<Activity className="h-3.5 w-3.5" aria-hidden="true" />
				</div>
			</div>

			<div className="mb-4 flex items-center gap-2">
				<span
					aria-hidden="true"
					className={`inline-block h-2 w-2 rounded-full ${TONE_DOT[overallTone]}`}
				/>
				<span className={`text-sm font-medium ${TONE_TEXT[overallTone]}`}>
					{overallLabel}
				</span>
			</div>

			<div className="flex-1 space-y-px border border-border">
				{[
					{ tone: "green" as const, label: "Operational", count: counts.green },
					{ tone: "yellow" as const, label: "Degraded", count: counts.yellow },
					{
						tone: "orange" as const,
						label: "Rate limited",
						count: counts.orange,
					},
					{ tone: "red" as const, label: "Outage", count: counts.red },
				].map((row) => (
					<div
						key={row.tone}
						className="flex items-center justify-between p-2.5"
					>
						<div className="flex items-center gap-2">
							<span
								aria-hidden="true"
								className={`inline-block h-1.5 w-1.5 rounded-full ${TONE_DOT[row.tone]}`}
							/>
							<span className="text-xs text-text-secondary">{row.label}</span>
						</div>
						<span className="text-sm font-medium text-text font-mono">
							{row.count}
						</span>
					</div>
				))}
			</div>

			<div className="mt-3 flex items-center justify-between text-[11px] text-text-muted">
				<span>
					Last checked {formatTime(new Date(dataUpdatedAt).toISOString())}
				</span>
				<a
					href="/dashboard?tab=health"
					className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent/80"
				>
					View all <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
				</a>
			</div>
		</div>
	);
}
