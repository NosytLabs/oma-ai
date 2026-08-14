"use client";

interface QuickStatsCardProps {
	loading: boolean;
	todayRequests: number;
	todayCost: number;
	totalTokens: number;
	avgLatencyMs: number;
	errorCount: number;
	activeModels: number;
}

/**
 * Compact "Today" stats card extracted from the inline grid in DashboardGrid.
 * Shows requests, spend, tokens, latency, active models, and errors for the
 * last 24 hours.
 */
export function QuickStatsCard({
	loading,
	todayRequests,
	todayCost,
	totalTokens,
	avgLatencyMs,
	errorCount,
	activeModels,
}: QuickStatsCardProps) {
	const formatTokens = (n: number) => {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
		return String(n);
	};

	const formatLatency = (ms: number) => {
		if (ms <= 0) return "\u2014";
		if (ms < 1000) return `${Math.round(ms)}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	};

	const rows = [
		{ label: "Requests", value: loading ? "\u2026" : todayRequests.toLocaleString() },
		// Show "FREE" instead of "$0.00" so a brand-new account never flashes
		// a misleading "$0.00 spent" — matches the playground cost chip.
		{ label: "Spend", value: loading ? "\u2026" : todayCost === 0 ? "FREE" : `$${todayCost.toFixed(2)}`, accent: true },
		{ label: "Tokens", value: loading ? "\u2026" : formatTokens(totalTokens), mono: true },
		{ label: "Avg latency", value: loading ? "\u2026" : formatLatency(avgLatencyMs), mono: true },
		{ label: "Active models", value: loading ? "\u2026" : String(activeModels) },
	];

	return (
		<div className="flex flex-col p-6 bg-surface/30 border border-border rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] relative h-full transition-colors duration-200 ease-out hover:border-accent/40">
 <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/40 via-accent/20 to-transparent" />
			<div className="mb-5">
				<h2 className="text-[14.5px] font-bold text-text-bright tracking-tight">Today</h2>
				<p className="mt-1 text-[11px] font-mono text-text-muted uppercase tracking-wider">Last 24 hours</p>
			</div>
			<div className="flex-1 space-y-0 border border-border/60 rounded-[var(--radius-md)] overflow-hidden bg-void shadow-sm">
				{rows.map((row) => (
					<div
						key={row.label}
						className="group flex items-center justify-between p-3.5 border-b border-border/40 hover:bg-surface/50 transition-colors duration-200 ease-out"
					>
						<span className="text-[12.5px] font-medium text-text-secondary">{row.label}</span>
						<span
							className={`text-[14px] ${
								row.accent ? "text-accent font-bold" : "text-text-bright font-semibold"
							} ${row.mono ? "font-mono" : ""}`}
						>
							{row.value}
						</span>
					</div>
				))}
				{!loading && errorCount > 0 && (
					<div className="flex items-center justify-between p-3.5 border-t border-error/20 bg-error/5 transition-colors duration-200 ease-out hover:bg-error/10">
						<span className="text-[12.5px] font-medium text-error">Errors</span>
						<span className="text-[14px] font-bold text-error font-mono">{errorCount}</span>
					</div>
				)}
			</div>
		</div>
	);
}
