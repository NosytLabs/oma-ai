"use client";

import { m } from "@/lib/framer-motion-client";
import { useMemo } from "react";
import { providerColor } from "@/components/ui/charts/shared";
import type { UsageRecord } from "@/lib/api";
import { formatUsdPrecise, toDollars } from "@/lib/utils";

interface ProviderBreakdownProps {
	usage: UsageRecord[];
	loading: boolean;
}

interface ProviderStats {
	provider: string;
	requests: number;
	totalCost: number;
}

function getProviderColor(provider: string): string {
	// Use `||` (not `??`) so an empty-string provider name falls back to the
	// shared `providerColor()` default branch instead of being passed through
	// as `''` (which would still resolve to the same accent fallback, but the
	// explicit `||` documents the empty-string intent). providerColor() returns
	// theme-aware CSS variables from `lib/charts/colors.ts` and falls back to
	// `CHART_COLORS.accent` for unknown providers.
	return providerColor(provider || "default");
}

export function ProviderBreakdown({ usage, loading }: ProviderBreakdownProps) {
	const providerStats = useMemo(() => {
		const statsMap = new Map<string, ProviderStats>();

		usage.forEach((record) => {
			const provider = record.provider || "unknown";
			const existing = statsMap.get(provider);
			// Billed amount (cost + markup); decimal-string cents, may be sub-cent.
			const cost = toDollars(record.totalCents ?? record.costCents);
			if (existing) {
				existing.requests++;
				existing.totalCost += cost;
			} else {
				statsMap.set(provider, {
					provider,
					requests: 1,
					totalCost: cost,
				});
			}
		});

		return Array.from(statsMap.values()).sort(
			(a, b) => b.totalCost - a.totalCost,
		);
	}, [usage]);

	const totalCost = providerStats.reduce((sum, p) => sum + p.totalCost, 0);

	if (loading && usage.length === 0) {
		return (
			<div className="p-6 border border-border/60 bg-surface rounded-[12px] shadow-sm">
				<div className="flex items-center gap-3 mb-4">
					<span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
					<span className="text-[13px] font-semibold text-text-secondary">
						Loading provider breakdown...
					</span>
				</div>
			</div>
		);
	}

	if (providerStats.length === 0) {
		return (
			<div className="p-6 border border-border/60 bg-surface rounded-[12px] shadow-sm">
				<h3 className="text-[14.5px] font-bold text-text-bright tracking-tight mb-2">
					Provider Breakdown
				</h3>
				<p className="text-[12.5px] text-text-muted leading-relaxed">No provider data yet.</p>
			</div>
		);
	}

	return (
		<div className="border border-border/60 bg-surface rounded-[12px] shadow-sm overflow-hidden h-full">
			<div className="p-6 border-b border-border/50">
				<h3 className="text-[14.5px] font-bold text-text-bright tracking-tight">
					Provider Breakdown
				</h3>
				<p className="text-[11px] font-mono text-text-muted uppercase tracking-wider mt-1.5 opacity-80">
					{providerStats.length} provider{providerStats.length !== 1 ? "s" : ""}{" "}
					· ${totalCost.toFixed(2)} total cost
				</p>
			</div>
			<div className="p-6 bg-void/50 h-[calc(100%-70px)]">
				<div className="space-y-5">
					{providerStats.map((stat, i) => {
						const pct = totalCost > 0 ? (stat.totalCost / totalCost) * 100 : 0;
						return (
							<m.div
								key={stat.provider}
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: i * 0.05 }}
							>
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-3">
										<div
											className="h-2.5 w-2.5 rounded-full"
											style={{
												backgroundColor: getProviderColor(stat.provider),
											}}
										/>
										<span className="text-[13px] font-bold text-text-bright uppercase tracking-wide">
											{stat.provider}
										</span>
									</div>
									<div className="flex items-center gap-4 text-[12px] text-text-muted">
										<span className="font-mono">{stat.requests.toLocaleString()} REQ</span>
										<span className="font-mono text-accent">
											{formatUsdPrecise(stat.totalCost)}
										</span>
										<span className="font-mono font-bold text-text-secondary w-12 text-right">
											{pct.toFixed(1)}%
										</span>
									</div>
								</div>
								<div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden shadow-inner">
									{/* scaleX instead of width — compositor-only, no per-frame layout */}
									<m.div
										className="h-full w-full rounded-full origin-left"
										style={{ backgroundColor: getProviderColor(stat.provider) }}
										initial={{ scaleX: 0 }}
										animate={{ scaleX: pct / 100 }}
										transition={{ duration: 0.5, delay: i * 0.05 }}
									/>
								</div>
							</m.div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
