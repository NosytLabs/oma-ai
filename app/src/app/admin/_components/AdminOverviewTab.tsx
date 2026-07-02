"use client";

import { Activity, Clock, CreditCard, Key, RefreshCw, TrendingUp, Users, Zap } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { formatUsd } from "@/lib/utils";
import type { AdminStats, UsageStats } from "./types";

const AdminOverviewCharts = dynamic(
	() =>
		import("@/components/admin/AdminOverviewCharts").then((m) => ({
			default: m.AdminOverviewCharts,
		})),
	{ ssr: false },
);

export type ChartDatum = { date: string; revenue: number; cost: number };

export type AdminOverviewTabProps = {
	adminStats: AdminStats | null;
	chartData: ChartDatum[];
	dailyUsage: UsageStats["dailyUsage"] | undefined;
	onRefresh: () => void;
};

export default function AdminOverviewTab({
	adminStats,
	chartData,
	dailyUsage,
	onRefresh,
}: AdminOverviewTabProps) {
	if (!adminStats) {
		return (
			<div className="flex flex-col items-center justify-center py-20">
				<div className="w-16 h-16 rounded border border-accent/30 bg-accent/10 flex items-center justify-center mb-6">
					<Activity className="w-8 h-8 text-accent" />
				</div>
				<h2 className="text-xl font-bold font-mono text-text-bright mb-2">
					No Data Available
				</h2>
				<p className="text-sm text-text-muted font-mono max-w-md text-center mb-6">
					Admin statistics will appear here once there is user activity on
					the gateway. Connect your database and start the server to begin
					tracking.
				</p>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={onRefresh}
						className="flex items-center gap-2 px-4 py-2 rounded border border-accent/30 bg-accent-dim text-accent hover:bg-accent/20 transition-colors text-sm font-mono"
					>
						<RefreshCw className="w-3.5 h-3.5" />
						Retry Fetch
					</button>
					<Link
						href="/admin/fees"
						className="flex items-center gap-2 px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text hover:border-border-bright transition-colors text-sm font-mono"
					>
						Configure Fees
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
				<div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
					<div className="flex items-center gap-2 mb-3">
						<Users className="w-3.5 h-3.5 text-text-muted" />
						<span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
							Total Users
						</span>
					</div>
					<p className="text-2xl font-bold font-mono text-text-bright">
						{adminStats.totalUsers.toLocaleString()}
					</p>
				</div>
				<div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
					<div className="flex items-center gap-2 mb-3">
						<Key className="w-3.5 h-3.5 text-text-muted" />
						<span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
							API Keys
						</span>
					</div>
					<p className="text-2xl font-bold font-mono text-text-bright">
						{adminStats.totalApiKeys.toLocaleString()}
					</p>
				</div>
				<div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
					<div className="flex items-center gap-2 mb-3">
						<CreditCard className="w-3.5 h-3.5 text-text-muted" />
						<span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
							Credits Purchased
						</span>
					</div>
					<p className="text-2xl font-bold font-mono text-success">
						{formatUsd(adminStats.totalDollarsPurchased)}
					</p>
				</div>
				<div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
					<div className="flex items-center gap-2 mb-3">
						<Zap className="w-3.5 h-3.5 text-text-muted" />
						<span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
							Usage This Month
						</span>
					</div>
					<p className="text-2xl font-bold font-mono text-amber">
						{formatUsd(adminStats.totalUsageThisMonth)}
					</p>
				</div>
				<div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
					<div className="flex items-center gap-2 mb-3">
						<TrendingUp className="w-3.5 h-3.5 text-text-muted" />
						<span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
							Revenue
						</span>
					</div>
					<p className="text-2xl font-bold font-mono text-accent">
						{formatUsd(adminStats.revenue)}
					</p>
				</div>
				<div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
					<div className="flex items-center gap-2 mb-3">
						<Clock className="w-3.5 h-3.5 text-text-muted" />
						<span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
							Active (24h)
						</span>
					</div>
					<p className="text-2xl font-bold font-mono text-text-bright">
						{adminStats.activeUsersLast24h}
					</p>
				</div>
			</div>

			<div className="rounded border border-border bg-surface p-5">
				<div className="flex items-center justify-between mb-5">
					<h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
						Provider Costs (This Month)
					</h3>
					<div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
				</div>
				<div className="space-y-3">
					<div className="flex items-center justify-between p-3 rounded border border-border bg-panel">
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 rounded border border-blue/30 bg-blue/10 flex items-center justify-center">
								<span className="text-[11px] font-bold font-mono text-blue">
									V
								</span>
							</div>
							<div>
								<p className="text-sm font-medium text-text-bright">
									Venice
								</p>
								<p className="text-[10px] text-text-muted">
									Primary provider
								</p>
							</div>
						</div>
						<p className="text-lg font-bold font-mono text-amber">
							{formatUsd(adminStats.providerCosts.venice)}
						</p>
					</div>
					<div className="flex items-center justify-between p-3 rounded border border-border bg-panel">
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 rounded border border-violet/30 bg-violet/10 flex items-center justify-center">
								<span className="text-[11px] font-bold font-mono text-violet">
									OR
								</span>
							</div>
							<div>
								<p className="text-sm font-medium text-text-bright">
									OpenRouter
								</p>
								<p className="text-[10px] text-text-muted">
									Backup provider
								</p>
							</div>
						</div>
						<p className="text-lg font-bold font-mono text-amber">
							{formatUsd(adminStats.providerCosts.openrouter)}
						</p>
					</div>
					<div className="border-t border-border pt-3 flex items-center justify-between">
						<p className="text-xs text-text-muted font-mono uppercase tracking-wider">
							Total Provider Costs
						</p>
						<p className="text-lg font-bold font-mono text-text-bright">
							{formatUsd(
								adminStats.providerCosts.venice +
									adminStats.providerCosts.openrouter,
							)}
						</p>
					</div>
				</div>
			</div>

			<AdminOverviewCharts
				chartData={chartData}
				dailyUsage={dailyUsage}
			/>
		</div>
	);
}