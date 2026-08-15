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
		<div className="flex flex-col h-full justify-between p-6 bg-[var(--color-surface)]/30 border border-[var(--color-border)] rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] relative overflow-hidden transition-[border-color,background-color] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)]/50">
			<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-success)]/40 via-[var(--color-success)]/20 to-transparent" />
			<div className="mb-6 flex items-start justify-between">
				<div>
					<h2 className="text-[14.5px] font-bold text-text-bright tracking-tight">System health</h2>
					<p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-text-muted">
						API readiness &amp; dependencies
					</p>
				</div>
				<div
					className={`flex h-10 w-10 rounded-[var(--radius-lg)] shadow-[0_0_15px_-5px_var(--color-success-glow)] items-center justify-center border ${overallTone === "green" ? "border-[var(--color-success)]/30 bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)]" : overallTone === "red" ? "border-[var(--color-error)]/30 bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)]" : "border-[var(--color-warning)]/30 bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]"} ${TONE_TEXT[overallTone]}`}
				>
					<Activity className="h-4 w-4" aria-hidden="true" />
				</div>
			</div>

			<div className="mb-4 flex items-center gap-3 bg-[var(--color-surface)]/50 p-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)]/50 shadow-inner">
				<span
					aria-hidden="true"
					className={`inline-block h-2.5 w-2.5 rounded-full ${overallTone === "green" ? "animate-pulse shadow-[0_0_8px_var(--color-success)]" : ""} ${TONE_DOT[overallTone]}`}
				/>
				<span className={`text-[13px] font-bold uppercase tracking-wider ${TONE_TEXT[overallTone]}`}>
					{overallLabel}
				</span>
			</div>

			<div className="flex-1 space-y-px border border-[var(--color-border)]/60 rounded-[var(--radius-md)] overflow-hidden bg-[var(--color-void)] shadow-sm">
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
						className="flex items-center justify-between p-3.5 border-b border-[var(--color-border)]/40 last:border-0 hover:bg-[var(--color-surface)]/50 transition-colors duration-200 ease-out"
					>
						<div className="flex items-center gap-3">
							<span
								aria-hidden="true"
								className={`inline-block h-2 w-2 rounded-full ${TONE_DOT[row.tone]}`}
							/>
							<span className="text-[12.5px] font-medium text-text-secondary">{row.label}</span>
						</div>
						<span className={`text-[14px] font-bold font-mono ${row.count > 0 ? "text-text-bright" : "text-text-muted"}`}>
							{row.count}
						</span>
					</div>
				))}
			</div>

			<div className="mt-5 pt-4 border-t border-[var(--color-border)]/50 flex items-center justify-between text-[10.5px] font-mono text-text-muted/80">
				<span>
					LAST CHECKED {formatTime(new Date(dataUpdatedAt).toISOString()).toUpperCase()}
				</span>
				<Link
					href="/dashboard?tab=health"
					className="inline-flex items-center gap-1.5 font-bold text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] uppercase tracking-widest transition-colors duration-200 ease-out active:scale-[0.97]"
				>
					View all <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
				</Link>
			</div>
		</div>
	);
}
