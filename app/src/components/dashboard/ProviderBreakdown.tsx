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
			<div className="p-6 sm:p-7 border border-border bg-surface/30 rounded-[var(--radius-lg)] shadow-[0_4px_24px_-10px_rgba(0,0,0,0.3)]">
				<div className="flex items-center gap-3">
					<span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_var(--color-accent)]" />
					<span className="text-sm font-semibold text-text-muted">
						Loading provider breakdown...
					</span>
				</div>
			</div>
		);
	}

	if (providerStats.length === 0) {
		return (
			<div className="p-6 sm:p-7 border border-border bg-surface/30 rounded-[var(--radius-lg)] shadow-[0_4px_24px_-10px_rgba(0,0,0,0.3)] transition-colors hover:border-accent/40">
				<h3 className="text-[14.5px] font-bold text-text-bright tracking-tight mb-2">
					Provider breakdown
				</h3>
				<p className="text-[12.5px] text-text-muted leading-relaxed">No provider data yet.</p>
			</div>
		);
	}

	return (
		<div className="border border-border bg-surface/30 rounded-[var(--radius-lg)] shadow-[0_4px_24px_-10px_rgba(0,0,0,0.3)] overflow-hidden h-full transition-colors hover:border-accent/40">
			<div className="p-6 sm:p-7 border-b border-border/50 bg-void/50">
				<h3 className="text-[14.5px] font-bold text-text-bright tracking-tight">
					Provider breakdown
				</h3>
				<p className="text-[11px] font-mono text-text-muted uppercase tracking-wider mt-1.5 opacity-80">
					{providerStats.length} provider{providerStats.length !== 1 ? "s" : ""}{" "}
					· ${totalCost.toFixed(2)} total cost
				</p>
			</div>
			<div className="p-6 sm:p-7 bg-void/30 h-full max-h-[400px] overflow-y-auto chat-scrollbar">
				<div className="space-y-6">
					{providerStats.map((stat, i) => {
						const pct = totalCost > 0 ? (stat.totalCost / totalCost) * 100 : 0;
						return (
							<m.div
								key={stat.provider}
								initial={{ opacity: 0, y: 5 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
								className="group"
							>
								<div className="flex flex-wrap items-center justify-between mb-2.5 gap-2">
									<div className="flex items-center gap-3">
										<div
											className="h-3 w-3 rounded-[var(--radius-sm)] shadow-[0_0_8px_-2px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-110"
											style={{
												backgroundColor: getProviderColor(stat.provider),
											}}
										/>
										<span className="text-[13px] font-bold text-text-bright uppercase tracking-wide transition-colors group-hover:text-accent">
											{stat.provider}
										</span>
									</div>
									<div className="flex items-center gap-4 text-[12px] text-text-muted transition-colors group-hover:text-text-secondary">
										<span className="font-mono">{stat.requests.toLocaleString()} REQ</span>
										<span className="font-mono font-bold text-accent transition-colors group-hover:text-accent-hover">
											{formatUsdPrecise(stat.totalCost)}
										</span>
										<span className="font-mono font-bold text-text-bright w-12 text-right">
											{pct.toFixed(1)}%
										</span>
									</div>
								</div>
								<div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden shadow-inner relative">
									{/* scaleX instead of width — compositor-only, no per-frame layout */}
									<m.div
										className="absolute inset-y-0 left-0 rounded-full origin-left transition-all duration-300"
										style={{ backgroundColor: getProviderColor(stat.provider) }}
										initial={{ scaleX: 0 }}
										animate={{ scaleX: pct / 100 }}
										transition={{ duration: 0.8, delay: i * 0.05, ease: [0.23, 1, 0.32, 1] }}
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
