"use client";

import Link from "next/link";
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
							System health
						</h2>
						<p className="mt-0.5 text-[11px] text-text-muted">
							API readiness &amp; dependencies
						</p>
					</div>
					<div className="flex h-8 w-8 items-center justify-center border border-accent/20 bg-accent/10 text-accent">
						<Activity className="h-3.5 w-3.5" aria-hidden="true" />
					</div>
				</div>
				<div className="flex flex-1 items-center gap-2 py-2 text-xs text-text-muted">
					<span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted" />
					Checking readiness…
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
		<div className="flex flex-col h-full justify-between p-6 bg-surface border border-border/60 rounded-[12px] shadow-sm relative overflow-hidden">
			<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-success/40 to-transparent" />
			<div className="mb-6 flex items-start justify-between">
				<div>
					<h2 className="text-[14.5px] font-bold text-text-bright tracking-tight">System health</h2>
					<p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-text-muted">
						API readiness &amp; dependencies
					</p>
				</div>
				<div
					className={`flex h-10 w-10 rounded-[8px] shadow-sm items-center justify-center border ${overallTone === "green" ? "border-success/20 bg-success/10" : overallTone === "red" ? "border-pink/20 bg-pink/10" : "border-warning/20 bg-warning/10"} ${TONE_TEXT[overallTone]}`}
				>
					<Activity className="h-4 w-4" aria-hidden="true" />
				</div>
			</div>

			<div className="mb-4 flex items-center gap-2.5 bg-void p-3 rounded-md border border-border/50">
				<span
					aria-hidden="true"
					className={`inline-block h-2.5 w-2.5 rounded-full ${TONE_DOT[overallTone]}`}
				/>
				<span className={`text-[13px] font-bold uppercase tracking-wide ${TONE_TEXT[overallTone]}`}>
					{overallLabel}
				</span>
			</div>

			<div className="flex-1 space-y-px border border-border/80 rounded-md overflow-hidden bg-void">
				{[
					{ tone: "green" as const, label: "Operational", count: counts.green },
					{ tone: "yellow" as const, label: "Degraded", count: counts.yellow },
					{
						tone: "orange" as const,
						label: "Rate limited",
						count: counts.orange,
					},
					// Use "Down" not "Outage" — the word "Outage" in a zero-count
					// row was reading as an active incident in audits/screenshots.
					{ tone: "red" as const, label: "Down", count: counts.red },
				].map((row) => (
					<div
						key={row.tone}
						className="flex items-center justify-between p-3 border-b border-border/40 last:border-0"
					>
						<div className="flex items-center gap-2.5">
							<span
								aria-hidden="true"
								className={`inline-block h-2 w-2 rounded-full ${TONE_DOT[row.tone]}`}
							/>
							<span className="text-[12.5px] font-medium text-text-secondary">{row.label}</span>
						</div>
						<span className="text-[14px] font-bold text-text-bright font-mono">
							{row.count}
						</span>
					</div>
				))}
			</div>

			<div className="mt-5 flex items-center justify-between text-[10.5px] font-mono text-text-muted/80">
				<span>
					LAST CHECKED {formatTime(new Date(dataUpdatedAt).toISOString()).toUpperCase()}
				</span>
				<Link
					href="/dashboard?tab=health"
					className="inline-flex items-center gap-1 font-bold text-accent hover:text-accent-bright uppercase tracking-widest transition-colors"
				>
					View all <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
				</Link>
			</div>
		</div>
	);
}
