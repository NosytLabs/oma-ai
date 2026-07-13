"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { m } from "framer-motion";
import {
	Activity,
	DollarSign,
	Gauge,
	Key,
	RefreshCw,
	ShieldAlert,
	Terminal,
	TrendingUp,
	Users,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { api } from "@/lib/api";
import type { AdminUser } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import AdminKeysTab from "./_components/AdminKeysTab";
import AdminOverviewTab from "./_components/AdminOverviewTab";
import AdminRevenueTab from "./_components/AdminRevenueTab";
import AdminUsageTab from "./_components/AdminUsageTab";
import AdminUsersTab from "./_components/AdminUsersTab";
import type {
	AdminStats,
	ApiKey,
	ExportCSV,
	RevenueStats,
	UsageStats,
} from "./_components/types";

type Tab =
	| "overview"
	| "users"
	| "usage"
	| "revenue"
	| "keys"
	| "fees"
	| "rate-limits";

const TABS: { id: Tab; Icon: LucideIcon }[] = [
	{ id: "overview", Icon: Activity },
	{ id: "users", Icon: Users },
	{ id: "usage", Icon: TrendingUp },
	{ id: "revenue", Icon: DollarSign },
	{ id: "keys", Icon: Key },
	{ id: "fees", Icon: DollarSign },
	{ id: "rate-limits", Icon: Gauge },
];

export default function AdminPage() {
	const [activeTab, setActiveTab] = useState<Tab>("overview");
	const [usersPage, setUsersPage] = useState(1);
	const [searchQuery, setSearchQuery] = useState("");
	const [usagePeriod, setUsagePeriod] = useState("30d");
	const [revenuePeriod, setRevenuePeriod] = useState("30d");

	const queryClient = useQueryClient();

	const refreshStats = () => {
		queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
		queryClient.invalidateQueries({ queryKey: ["adminUsage"] });
		queryClient.invalidateQueries({ queryKey: ["adminRevenue"] });
		queryClient.invalidateQueries({ queryKey: ["adminKeys"] });
	};

	const usersQuery = useQuery({
		queryKey: ["adminUsers", usersPage],
		queryFn: () => api.admin.getUsers(usersPage, 50),
		staleTime: 30_000,
		// ponytail: only fetch when the user actually opens the users tab.
		enabled: activeTab === "users",
	});

	const usageQuery = useQuery({
		queryKey: ["adminUsage", usagePeriod],
		queryFn: () => api.admin.getUsage(usagePeriod),
		staleTime: 30_000,
		enabled: activeTab === "usage",
	});

	const revenueQuery = useQuery({
		queryKey: ["adminRevenue", revenuePeriod],
		queryFn: () => api.admin.getRevenue(revenuePeriod),
		staleTime: 30_000,
		enabled: activeTab === "revenue",
	});

	const keysQuery = useQuery({
		queryKey: ["adminKeys"],
		queryFn: () =>
			api.admin
				.getKeys(1, 100)
				.then((data) => (data as { keys?: ApiKey[] })?.keys ?? []),
		staleTime: 30_000,
		enabled: activeTab === "keys",
	});

	const users = useMemo(
		() => (usersQuery.data?.users ?? []) as AdminUser[],
		[usersQuery.data?.users],
	);
	const usersLoading = usersQuery.isLoading;
	const usersTotal = usersQuery.data?.pagination?.total ?? 0;
	const usageStats: UsageStats | null = usageQuery.data ?? null;
	const revenueStats = (revenueQuery.data ?? null) as RevenueStats | null;
	const apiKeys: ApiKey[] = keysQuery.data ?? [];

	const adminStats: AdminStats | null = useMemo(() => {
		if (!usageStats || !revenueStats || !usersQuery.data?.pagination)
			return null;
		const now = new Date();
		const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const activeUsersLast24h = users.filter(
			(u) => u.lastActivityAt && new Date(u.lastActivityAt) > last24h,
		).length;
		return {
			totalUsers: usersQuery.data.pagination.total,
			totalApiKeys: apiKeys.length,
			totalDollarsPurchased: revenueStats.summary.totalDeposits,
			totalUsageThisMonth: usageStats.summary.totalRevenue,
			revenue:
				revenueStats.summary.totalRevenue - revenueStats.summary.totalCost,
			activeUsersLast24h,
			providerCosts: {
				venice:
					usageStats.byProvider.find((p) => p.provider === "venice")
						?.totalCost ?? 0,
				openrouter:
					usageStats.byProvider.find((p) => p.provider === "openrouter")
						?.totalCost ?? 0,
			},
		};
	}, [usageStats, revenueStats, usersQuery.data, users, apiKeys.length]);

	const filteredUsers = useMemo(() => {
		if (!searchQuery) return users;
		const q = searchQuery.toLowerCase();
		return users.filter(
			(u) =>
				u.address.toLowerCase().includes(q) ||
				u.accountNumber?.toLowerCase().includes(q),
		);
	}, [users, searchQuery]);

	const exportCSV: ExportCSV = (data, filename) => {
		if (!data?.length) return;
		const headers = Object.keys(data[0] as object);
		const csv = [
			headers.join(","),
			...data.map((row) =>
				headers
					.map((h) => JSON.stringify((row as Record<string, unknown>)[h] ?? ""))
					.join(","),
			),
		];
		const blob = new Blob([csv.join("\n")], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${filename}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const chartData = useMemo(() => {
		if (!revenueStats?.dailyRevenue && !revenueStats?.monthlyRevenue) return [];
		if (revenueStats.dailyRevenue) return revenueStats.dailyRevenue;
		return revenueStats.monthlyRevenue.map((m) => ({
			date: m.month,
			revenue: m.totalRevenue,
			cost: 0,
		}));
	}, [revenueStats]);

	const isUnauthorized = useMemo(() => {
		const errors = [
			usersQuery.error,
			usageQuery.error,
			revenueQuery.error,
			keysQuery.error,
		];
		return errors.some((err) => err instanceof ApiError && err.status === 403);
	}, [usersQuery.error, usageQuery.error, revenueQuery.error, keysQuery.error]);

	if (isUnauthorized) {
		return (
			<div className="min-h-screen bg-void text-text flex flex-col items-center justify-center px-4">
				<div className="rounded border border-border bg-surface p-10 max-w-md w-full text-center">
					<div className="w-16 h-16 rounded border border-error/30 bg-error-dim flex items-center justify-center mx-auto mb-6">
						<ShieldAlert className="w-8 h-8 text-error" />
					</div>
					<h1 className="text-xl font-bold font-display tracking-tight text-text-bright mb-2">
						Not Authorized
					</h1>
					<p className="text-sm text-text-muted font-mono mb-6">
						You don&apos;t have admin access. This area is restricted to
						authorized administrators only.
					</p>
					<Link
						href="/"
						className="inline-flex items-center gap-2 px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text hover:border-border-bright transition-colors text-sm font-mono"
					>
						Return Home
					</Link>
				</div>
			</div>
		);
	}

	const content = (
		<div className="min-h-screen bg-void text-text">
			<div className="border-b border-border bg-surface">
				<div className="max-w-[95rem] mx-auto px-4 py-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="w-9 h-9 rounded border border-accent bg-accent-dim flex items-center justify-center">
								<Terminal className="w-4 h-4 text-accent" />
							</div>
							<div>
								<h1 className="text-lg font-bold font-display tracking-tight text-text-bright">
									OMA Admin
								</h1>
								<p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
									Gateway Operations
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-surface">
								<span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
								<span className="text-[11px] font-mono text-text-muted">
									LIVE
								</span>
							</div>
							<m.button
								whileHover={{ scale: 1.02 }}
								whileTap={{ scale: 0.98 }}
								onClick={() => refreshStats()}
								className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text hover:border-border-bright transition-colors text-sm"
							>
								<RefreshCw className="w-3.5 h-3.5" />
								<span className="hidden sm:inline">Refresh</span>
							</m.button>
						</div>
					</div>
				</div>
			</div>

			<div className="border-b border-border">
				<div className="max-w-[95rem] mx-auto px-4">
					<div
						role="tablist"
						aria-label="Admin sections"
						className="flex gap-0.5 overflow-x-auto scrollbar-none"
					>
						{TABS.map(({ id, Icon }) => (
							<button
								type="button"
								key={id}
								role="tab"
								id={`admin-tab-${id}`}
								aria-selected={activeTab === id}
								aria-controls="admin-tabpanel"
								onClick={() => setActiveTab(id)}
								className={`px-4 py-3 text-xs font-medium font-mono uppercase tracking-wider transition-all whitespace-nowrap rounded-lg ${
									activeTab === id
										? "text-accent bg-accent-dim/30 ring-1 ring-accent/30"
										: "text-text-muted hover:text-text-secondary hover:bg-surface hover:ring-1 hover:ring-border"
								}`}
							>
								<Icon
									className="w-3.5 h-3.5 inline mr-1.5"
									aria-hidden="true"
								/>
								{id}
							</button>
						))}
					</div>
				</div>
			</div>

			<div
				id="admin-tabpanel"
				role="tabpanel"
				aria-labelledby={`admin-tab-${activeTab}`}
				tabIndex={0}
				className="max-w-[95rem] mx-auto px-4 py-6 focus:outline-none"
			>
				{activeTab === "overview" && (
					<AdminOverviewTab
						adminStats={adminStats}
						chartData={chartData}
						dailyUsage={usageStats?.dailyUsage}
						onRefresh={refreshStats}
					/>
				)}

				{activeTab === "users" && (
					<AdminUsersTab
						users={filteredUsers}
						usersLoading={usersLoading}
						usersTotal={usersTotal}
						usersPage={usersPage}
						setUsersPage={setUsersPage}
						searchQuery={searchQuery}
						setSearchQuery={setSearchQuery}
					/>
				)}

				{activeTab === "usage" && (
					<AdminUsageTab
						usageStats={usageStats}
						usagePeriod={usagePeriod}
						setUsagePeriod={setUsagePeriod}
						exportCSV={exportCSV}
					/>
				)}

				{activeTab === "revenue" && (
					<AdminRevenueTab
						revenueStats={revenueStats}
						revenuePeriod={revenuePeriod}
						setRevenuePeriod={setRevenuePeriod}
						exportCSV={exportCSV}
					/>
				)}

				{activeTab === "keys" && (
					<AdminKeysTab apiKeys={apiKeys} exportCSV={exportCSV} />
				)}

				{activeTab === "fees" && (
					<div className="rounded border border-border bg-surface p-8 text-center">
						<DollarSign className="w-12 h-12 text-text-muted mx-auto mb-4" />
						<p className="text-text-muted font-mono">Fee configuration</p>
						<Link
							href="/admin/fees"
							className="text-accent hover:underline mt-2 inline-block font-mono text-sm"
						>
							Open Fee Configuration →
						</Link>
					</div>
				)}

				{activeTab === "rate-limits" && (
					<div className="rounded border border-border bg-surface p-8 text-center">
						<Gauge className="w-12 h-12 text-text-muted mx-auto mb-4" />
						<p className="text-text-muted font-mono">
							Rate limit configuration
						</p>
						<Link
							href="/admin/rate-limits"
							className="text-accent hover:underline mt-2 inline-block font-mono text-sm"
						>
							Open Rate Limits →
						</Link>
					</div>
				)}
			</div>
		</div>
	);

	return (
		<ErrorBoundary
			fallback={
				<div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
					<h2 className="font-mono text-text text-lg">Admin Panel Error</h2>
					<p className="text-sm text-text-muted max-w-md font-mono">
						An unexpected error occurred in the admin panel.
					</p>
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="btn-primary flex items-center gap-2"
					>
						↻ Retry
					</button>
				</div>
			}
		>
			{content}
		</ErrorBoundary>
	);
}
