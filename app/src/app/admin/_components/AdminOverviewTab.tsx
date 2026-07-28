"use client";

import { Activity, BarChart3, Clock, CreditCard, Flame, Key, RefreshCw, TrendingUp, Users, Zap } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { formatUsd } from "@/lib/utils";
import type { AdminStats, UsageStats } from "./types";

const AdminOverviewCharts = dynamic(
	() =>
		import("@/components/admin/AdminOverviewCharts").then((m) => ({
			default: m.AdminOverviewCharts,
		})),
	{ ssr: false },
);

type ChartDatum = { date: string; revenue: number; cost: number };

/**
 * Display metadata for known providers. Unknown provider keys fall back to a
 * capitalized label so new providers render without a code change.
 */
const PROVIDER_META: Record<
	string,
	{ label: string; description: string; badgeClass: string }
> = {
	venice: {
		label: "Venice",
		description: "Primary provider",
		badgeClass: "border-blue/30 bg-blue/10 text-blue",
	},
	gonka: {
		label: "OMA-AI",
		description: "Decentralized provider",
		badgeClass: "border-violet/30 bg-violet/10 text-violet",
	},
	surplus: {
		label: "Surplus",
		description: "Discounted surplus capacity",
		badgeClass: "border-success/30 bg-success/10 text-success",
	},
};

function providerMeta(provider: string) {
	return (
		PROVIDER_META[provider] ?? {
			label: provider.charAt(0).toUpperCase() + provider.slice(1),
			description: "Inference provider",
			badgeClass: "border-border bg-panel text-text-secondary",
		}
	);
}

export type AdminOverviewTabProps = {
	adminStats: AdminStats | null;
	chartData: ChartDatum[];
	dailyUsage: UsageStats["dailyUsage"] | undefined;
	onRefresh: () => void;
};

interface TopUserRow {
	userId: string;
	address: string | null;
	accountNumber: string | null;
	totalRequests: number;
	totalRevenue: number;
	balanceDollars: number;
	lastActivityAt: string | null;
}

interface PopularModelRow {
	model: string;
	provider: string;
	requests: number;
	uniqueUsers: number;
	totalRevenue: number;
	errorRate: number;
}

export default function AdminOverviewTab({
	adminStats,
	chartData,
	dailyUsage,
	onRefresh,
}: AdminOverviewTabProps) {
	// Top users + model popularity are loaded independently so they don't
	// block the main overview render. Both endpoints are admin-only and
	// already gated server-side; failures degrade to an empty state.
	const [topUsers, setTopUsers] = useState<TopUserRow[] | null>(null);
	const [popularModels, setPopularModels] = useState<PopularModelRow[] | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/v1/admin/usage/top-users?period=30d&limit=10")
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (cancelled) return;
				setTopUsers(data?.topUsers ?? []);
			})
			.catch(() => {
				if (cancelled) return;
				setTopUsers([]);
			});
		fetch("/api/v1/admin/usage/model-popularity?period=30d&limit=10")
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (cancelled) return;
				setPopularModels(data?.models ?? []);
			})
			.catch(() => {
				if (cancelled) return;
				setPopularModels([]);
			});
		return () => {
			cancelled = true;
		};
	}, [adminStats]);
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
							Gross Profit
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
					{Object.entries(adminStats.providerCosts).map(([provider, cost]) => {
						const meta = providerMeta(provider);
						return (
							<div
								key={provider}
								className="flex items-center justify-between p-3 rounded border border-border bg-panel"
							>
								<div className="flex items-center gap-3">
									<div
										className={`w-8 h-8 rounded border flex items-center justify-center ${meta.badgeClass}`}
									>
										<span className="text-[11px] font-bold font-mono">
											{meta.label.charAt(0)}
										</span>
									</div>
									<div>
										<p className="text-sm font-medium text-text-bright">
											{meta.label}
										</p>
										<p className="text-[10px] text-text-muted">
											{meta.description}
										</p>
									</div>
								</div>
								<p className="text-lg font-bold font-mono text-amber">
									{formatUsd(cost)}
								</p>
							</div>
						);
					})}
					{Object.keys(adminStats.providerCosts).length === 0 && (
						<p className="text-sm text-text-muted font-mono">
							No provider costs recorded this month.
						</p>
					)}
					<div className="border-t border-border pt-3 flex items-center justify-between">
						<p className="text-xs text-text-muted font-mono uppercase tracking-wider">
							Total Provider Costs
						</p>
						<p className="text-lg font-bold font-mono text-text-bright">
							{formatUsd(
								Object.values(adminStats.providerCosts).reduce(
									(sum, cost) => sum + cost,
									0,
								),
							)}
						</p>
					</div>
				</div>
			</div>

			<AdminOverviewCharts
				chartData={chartData}
				dailyUsage={dailyUsage}
			/>

			{/* Top users + model popularity — wire into the existing 30d
			    window so the spend trend aligns with the charts above.
			    Both endpoints live on /admin/usage/* and are admin-gated. */}
			<div className="grid gap-6 lg:grid-cols-2">
				<div className="rounded border border-border bg-surface p-5">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<Flame className="w-4 h-4 text-amber" />
							<h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
								Top Users (30d)
							</h3>
						</div>
						<Link
							href="/admin/users"
							className="text-[10px] text-text-muted hover:text-accent font-mono uppercase tracking-wider"
						>
							View all →
						</Link>
					</div>
					{topUsers === null ? (
						<div className="space-y-2">
							{[...Array(5)].map((_, i) => (
								<div key={i} className="h-9 rounded bg-panel animate-pulse" />
							))}
						</div>
					) : topUsers.length === 0 ? (
						<p className="text-sm text-text-muted py-4 text-center">
							No usage recorded in the last 30 days.
						</p>
					) : (
						<div className="space-y-2">
							{topUsers.map((u, i) => (
								<div
									key={u.userId}
									className="flex items-center justify-between p-2 rounded border border-border/50 bg-panel hover:border-accent/30 transition-colors"
								>
									<div className="flex items-center gap-3 min-w-0">
										<span className="text-[10px] font-mono text-text-muted w-4 shrink-0">
											#{i + 1}
										</span>
										<div className="min-w-0">
											<p className="text-sm font-mono text-text-bright truncate">
												{u.accountNumber ||
													(u.address
														? `${u.address.slice(0, 6)}…${u.address.slice(-4)}`
														: u.userId.slice(0, 8))}
											</p>
											<p className="text-[10px] text-text-muted">
												{u.totalRequests.toLocaleString()} requests ·{" "}
												{formatUsd(u.balanceDollars)} balance
											</p>
										</div>
									</div>
									<p className="text-sm font-bold font-mono text-accent shrink-0">
										{formatUsd(u.totalRevenue)}
									</p>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="rounded border border-border bg-surface p-5">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<BarChart3 className="w-4 h-4 text-accent" />
							<h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
								Model Popularity (30d)
							</h3>
						</div>
						<Link
							href="/admin?tab=usage"
							className="text-[10px] text-text-muted hover:text-accent font-mono uppercase tracking-wider"
						>
							View all →
						</Link>
					</div>
					{popularModels === null ? (
						<div className="space-y-2">
							{[...Array(5)].map((_, i) => (
								<div key={i} className="h-9 rounded bg-panel animate-pulse" />
							))}
						</div>
					) : popularModels.length === 0 ? (
						<p className="text-sm text-text-muted py-4 text-center">
							No model usage in the last 30 days.
						</p>
					) : (
						<div className="space-y-2">
							{popularModels.map((m, i) => {
								const meta = providerMeta(m.provider);
								const errorBadge =
									m.errorRate >= 10
										? "border-error/30 text-error"
										: m.errorRate >= 5
											? "border-amber/30 text-amber"
											: "border-success/30 text-success";
								return (
									<div
										key={`${m.model}-${m.provider}`}
										className="flex items-center justify-between p-2 rounded border border-border/50 bg-panel hover:border-accent/30 transition-colors"
									>
										<div className="flex items-center gap-3 min-w-0">
											<span className="text-[10px] font-mono text-text-muted w-4 shrink-0">
												#{i + 1}
											</span>
											<div
												className={`w-7 h-7 rounded border flex items-center justify-center shrink-0 ${meta.badgeClass}`}
											>
												<span className="text-[10px] font-bold font-mono">
													{meta.label.charAt(0)}
												</span>
											</div>
											<div className="min-w-0">
												<p className="text-sm font-mono text-text-bright truncate">
													{m.model}
												</p>
												<p className="text-[10px] text-text-muted">
													{m.uniqueUsers} unique users · {formatUsd(m.totalRevenue)}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-2 shrink-0">
											<span
												className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${errorBadge}`}
												title={`${m.errorRate}% error rate`}
											>
												{m.errorRate.toFixed(1)}%
											</span>
											<p className="text-sm font-bold font-mono text-accent w-14 text-right">
												{m.requests.toLocaleString()}
											</p>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}