"use client";

import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { useMemo } from "react";
import type { UsageRecord } from "@/lib/api";
import { formatUsdPrecise, toDollars } from "@/lib/utils";

interface ModelUsageTableProps {
	usage: UsageRecord[];
	loading: boolean;
}

interface ModelStats {
	model: string;
	requests: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCost: number;
	avgLatency: number;
}

/**
	* Internal accumulator used inside the aggregation loop. Tracks the running
	* latency sum (`avgLatency` doubles as a sum until we divide by `_latencyCount`
	* in the final map) plus the number of records that actually had a usable
	* latency reading. Strips `_latencyCount` before returning the public shape.
	*/
interface ModelStatsAccumulator extends ModelStats {
	_latencyCount: number;
}

export function ModelUsageTable({ usage, loading }: ModelUsageTableProps) {
	const modelStats = useMemo(() => {
		const statsMap = new Map<string, ModelStatsAccumulator>();

		usage.forEach((record) => {
			const existing = statsMap.get(record.model);
			// Only count latency records that are finite numbers (the field is
			// optional and may be null for in-flight or failed requests). Records
			// without a valid latencyMs contribute to requests/tokens/cost but not
			// to the average, so the displayed value reflects what we actually have.
			const hasLatency =
				typeof record.latencyMs === "number" &&
				Number.isFinite(record.latencyMs);
			// Billed amount (cost + markup) as decimal-string cents; may be
			// sub-cent. `toDollars` tolerates null/undefined/garbage → 0.
			const billedDollars = toDollars(
				record.totalCents ?? record.costCents,
			);
			if (existing) {
				existing.requests++;
				existing.totalInputTokens += record.promptTokens ?? 0;
				existing.totalOutputTokens += record.completionTokens ?? 0;
				existing.totalCost += billedDollars;
				if (hasLatency) {
					existing.avgLatency += record.latencyMs as number;
					existing._latencyCount += 1;
				}
			} else {
				statsMap.set(record.model, {
					model: record.model,
					requests: 1,
					totalInputTokens: record.promptTokens ?? 0,
					totalOutputTokens: record.completionTokens ?? 0,
					totalCost: billedDollars,
					avgLatency: hasLatency ? (record.latencyMs as number) : 0,
					_latencyCount: hasLatency ? 1 : 0,
				});
			}
		});

		return Array.from(statsMap.values())
			.map(({ _latencyCount, ...stat }) => ({
				...stat,
				avgLatency: _latencyCount > 0 ? stat.avgLatency / _latencyCount : 0,
			}))
			.sort((a, b) => b.totalCost - a.totalCost)
			.slice(0, 10);
	}, [usage]);

	const totalCost = modelStats.reduce((sum, m) => sum + m.totalCost, 0);
	const totalRequests = modelStats.reduce((sum, m) => sum + m.requests, 0);

	const formatLatency = (ms: number) => {
		if (ms <= 0) return "—";
		return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
	};

	if (loading && usage.length === 0) {
		return (
<div className="p-6 border border-border bg-surface/30 rounded-[var(--radius-xl)] shadow-[var(--shadow-md)]">
			<div className="flex items-center gap-3">
					<span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_var(--color-accent)]" />
					<span className="text-sm font-semibold text-text-muted">
						Loading model breakdown...
					</span>
				</div>
			</div>
		);
	}

	if (modelStats.length === 0) {
		return (
			<div className="p-6 border border-border bg-surface/30 rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] transition-colors duration-200 ease-out hover:border-accent/40">
				<h3 className="text-[14.5px] font-bold text-text-bright tracking-tight mb-2">
					Model usage breakdown
				</h3>
				<p className="text-[12.5px] text-text-muted leading-relaxed">
					No model usage data yet. Start making API calls to see breakdown.
				</p>
			</div>
		);
	}

	return (
		<div className="border border-border bg-surface/30 rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] overflow-hidden transition-colors duration-200 ease-out hover:border-accent/40">
			<div className="p-6 border-b border-border/50 bg-void/50">
				<h3 className="text-[14.5px] font-bold text-text-bright tracking-tight">
					Model usage breakdown
				</h3>
				<p className="text-[11px] font-mono text-text-muted uppercase tracking-wider mt-1.5 opacity-80">
					{totalRequests.toLocaleString()} total requests · $
					{totalCost.toFixed(2)} total cost
				</p>
			</div>
			<div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
						<table className="w-full min-w-[30rem] text-left">
					<thead>
						<tr className="border-b border-border/50 bg-surface/20">
							<th
								scope="col"
								className="px-6 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider"
							>
								Model
							</th>
							<th
								scope="col"
								className="px-6 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider text-right"
							>
								Requests
							</th>
							<th
								scope="col"
								className="px-6 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider text-right"
							>
								Tokens
							</th>
							<th
								scope="col"
								className="px-6 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider text-right"
							>
								Cost
							</th>
							<th
								scope="col"
								className="px-6 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider text-right"
							>
								Avg Latency
							</th>
							<th
								scope="col"
								className="px-6 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider text-right"
							>
								% of Total
							</th>
						</tr>
					</thead>
					<tbody className="bg-void/30">
						{modelStats.map((stat, i) => (
							<m.tr
								key={stat.model}
								className="group border-b border-border/40 hover:bg-surface/60 transition-colors duration-200 ease-out last:border-0"
								initial={{ opacity: 0, y: 5 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: i * 0.03, ...springs.soft }}
							>
								<td className="px-6 py-4 text-[13px] font-bold text-accent font-mono transition-colors duration-200 ease-out group-hover:text-accent-hover">
									{stat.model}
								</td>
								<td className="px-6 py-4 text-[13px] text-text-secondary text-right font-mono transition-colors duration-200 ease-out group-hover:text-text-bright">
									{stat.requests.toLocaleString()}
								</td>
								<td className="px-6 py-4 text-[13px] text-text-secondary text-right font-mono transition-colors duration-200 ease-out group-hover:text-text-bright">
									<div className="flex flex-col">
										<span className="text-text-bright" title="Input Tokens">{(stat.totalInputTokens / 1000).toFixed(1)}k <span className="text-text-muted text-[10px] ml-1">IN</span></span>
										<span className="text-text-secondary mt-0.5" title="Output Tokens">{(stat.totalOutputTokens / 1000).toFixed(1)}k <span className="text-text-muted/50 text-[10px] ml-1">OUT</span></span>
									</div>
								</td>
								<td className="px-6 py-4 text-[13px] font-bold text-text-bright text-right font-mono">
									{formatUsdPrecise(stat.totalCost)}
								</td>
								<td className="px-6 py-4 text-[12.5px] text-text-secondary text-right font-mono transition-colors duration-200 ease-out group-hover:text-text-bright">
									{formatLatency(stat.avgLatency)}
								</td>
								<td className="px-6 py-4 text-right">
									<div className="flex items-center justify-end gap-3">
										<div className="w-16 h-1.5 bg-surface-elevated rounded-full overflow-hidden shadow-inner">
											<div
												className="h-full bg-accent rounded-full transition-[background-color,border-color,box-shadow,color,transform] duration-500"
												style={{
													width: `${totalCost > 0 ? (stat.totalCost / totalCost) * 100 : 0}%`,
												}}
											/>
										</div>
										<span className="text-[11.5px] font-bold text-text-secondary w-10 text-right font-mono transition-colors duration-200 ease-out group-hover:text-text-bright">
											{totalCost > 0
												? ((stat.totalCost / totalCost) * 100).toFixed(1)
												: "0.0"}
											%
										</span>
									</div>
								</td>
							</m.tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
