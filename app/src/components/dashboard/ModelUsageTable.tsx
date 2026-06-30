"use client";

import { m } from "framer-motion";
import { useMemo } from "react";
import type { UsageRecord } from "@/lib/api";
import { toDollars } from "@/lib/utils";

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
			if (existing) {
				existing.requests++;
				existing.totalInputTokens += record.promptTokens;
				existing.totalOutputTokens += record.completionTokens;
				existing.totalCost += toDollars(record.costCents);
				if (hasLatency) {
					existing.avgLatency += record.latencyMs as number;
					existing._latencyCount += 1;
				}
			} else {
				statsMap.set(record.model, {
					model: record.model,
					requests: 1,
					totalInputTokens: record.promptTokens,
					totalOutputTokens: record.completionTokens,
					totalCost: toDollars(record.costCents),
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
			<div className="p-6 border border-border bg-void">
				<div className="flex items-center gap-2 mb-4">
					<span className="inline-block h-2 w-2 bg-text-muted animate-pulse" />
					<span className="text-sm text-text-muted">
						Loading model breakdown...
					</span>
				</div>
			</div>
		);
	}

	if (modelStats.length === 0) {
		return (
			<div className="p-6 border border-border bg-void">
				<h3 className="text-sm font-semibold text-text-bright mb-2">
					Model Usage Breakdown
				</h3>
				<p className="text-sm text-text-muted">
					No model usage data yet. Start making API calls to see breakdown.
				</p>
			</div>
		);
	}

	return (
		<div className="border border-border bg-void">
			<div className="p-6 border-b border-border">
				<h3 className="text-sm font-semibold text-text-bright">
					Model Usage Breakdown
				</h3>
				<p className="text-[11px] text-text-muted mt-1">
					{totalRequests.toLocaleString()} total requests · $
					{totalCost.toFixed(2)} total cost
				</p>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full text-left">
					<thead>
						<tr className="border-b border-border bg-surface/30">
							<th
								scope="col"
								className="px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider"
							>
								Model
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right"
							>
								Requests
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right"
							>
								Input Tokens
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right"
							>
								Output Tokens
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right"
							>
								Cost
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right"
							>
								Avg Latency
							</th>
							<th
								scope="col"
								className="px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right"
							>
								% of Total
							</th>
						</tr>
					</thead>
					<tbody>
						{modelStats.map((stat, i) => (
							<m.tr
								key={stat.model}
								className="border-b border-border hover:bg-surface/50 transition-colors"
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ delay: i * 0.03 }}
							>
								<td className="px-6 py-4 text-sm font-medium text-success">
									{stat.model}
								</td>
								<td className="px-6 py-4 text-sm text-text-secondary text-right">
									{stat.requests.toLocaleString()}
								</td>
								<td className="px-6 py-4 text-sm text-text-secondary text-right">
									{stat.totalInputTokens.toLocaleString()}
								</td>
								<td className="px-6 py-4 text-sm text-text-secondary text-right">
									{stat.totalOutputTokens.toLocaleString()}
								</td>
								<td className="px-6 py-4 text-sm text-text-secondary text-right">
									${stat.totalCost.toFixed(4)}
								</td>
								<td className="px-6 py-4 text-sm text-text-secondary text-right font-mono">
									{formatLatency(stat.avgLatency)}
								</td>
								<td className="px-6 py-4 text-right">
									<div className="flex items-center justify-end gap-2">
										<div className="w-16 h-1.5 bg-surface rounded-full overflow-hidden">
											<div
												className="h-full bg-accent rounded-full"
												style={{
													width: `${totalCost > 0 ? (stat.totalCost / totalCost) * 100 : 0}%`,
												}}
											/>
										</div>
										<span className="text-xs text-text-muted w-10 text-right">
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
