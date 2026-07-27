"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { m } from "@/lib/framer-motion-client";
import {
	Activity,
	Boxes,
	CircleDollarSign,
	CreditCard,
	DollarSign,
	FileText,
	Gauge,
	Key,
	RefreshCw,
	RotateCcw,
	ScrollText,
	ShieldAlert,
	Terminal,
	TrendingUp,
	Users,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { api } from "@/lib/api";
import type { AdminUser } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import AdminAuditLogsTab from "./_components/AdminAuditLogsTab";
import AdminDlqTab from "./_components/AdminDlqTab";
import AdminInvoicesTab from "./_components/AdminInvoicesTab";
import AdminKeysTab from "./_components/AdminKeysTab";
import AdminOverviewTab from "./_components/AdminOverviewTab";
import AdminPolarTab from "./_components/AdminPolarTab";
import AdminRefundsTab from "./_components/AdminRefundsTab";
import AdminRevenueTab from "./_components/AdminRevenueTab";
import AdminSurplusTab from "./_components/AdminSurplusTab";
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
	| "audit-logs"
	| "dlq"
	| "refunds"
	| "invoices"
	| "surplus"
	| "polar"
	| "fees"
	| "rate-limits";

const TABS: { id: Tab; Icon: LucideIcon; href?: string }[] = [
	{ id: "overview", Icon: Activity },
	{ id: "users", Icon: Users },
	{ id: "usage", Icon: TrendingUp },
	{ id: "revenue", Icon: DollarSign },
	{ id: "keys", Icon: Key },
	{ id: "audit-logs", Icon: ScrollText },
	{ id: "dlq", Icon: RotateCcw },
	{ id: "refunds", Icon: CircleDollarSign },
	{ id: "invoices", Icon: FileText },
	{ id: "surplus", Icon: Boxes },
	{ id: "polar", Icon: CreditCard },
	// Full pages — navigate instead of empty stub panels
	{ id: "fees", Icon: DollarSign, href: "/admin/fees" },
	{ id: "rate-limits", Icon: Gauge, href: "/admin/rate-limits" },
];

export default function AdminPage() {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<Tab>("overview");
	const [usersPage, setUsersPage] = useState(1);
	const [searchQuery, setSearchQuery] = useState("");
	const [usagePeriod, setUsagePeriod] = useState("30d");
	const [revenuePeriod, setRevenuePeriod] = useState("30d");

	const queryClient = useQueryClient();

	const selectTab = (id: Tab, href?: string) => {
		if (href) {
			router.push(href);
			return;
		}
		setActiveTab(id);
	};

	const refreshStats = () => {
		queryClient.invalidateQueries({ queryKey: ["adminUsers"] });
		queryClient.invalidateQueries({ queryKey: ["adminUsage"] });
		queryClient.invalidateQueries({ queryKey: ["adminRevenue"] });
		queryClient.invalidateQueries({ queryKey: ["adminKeys"] });
	};

	// Auth failures are terminal — retrying 401/403 three times just delays
	// the auth gate by ~7s while the bare shell flashes "No Data Available".
	const noAuthRetry = (failureCount: number, error: unknown) => {
		if (
			error instanceof ApiError &&
			(error.status === 401 || error.status === 403)
		) {
			return false;
		}
		return failureCount < 2;
	};

	// Overview aggregates users + usage + revenue + keys. Enable those
	// queries on overview as well as on their own tabs (previously overview
	// stayed empty forever because nothing was fetched until tab switch).
	const usersQuery = useQuery({
		queryKey: ["adminUsers", usersPage],
		queryFn: () => api.admin.getUsers(usersPage, 50),
		staleTime: 30_000,
		retry: noAuthRetry,
		enabled: activeTab === "users" || activeTab === "overview",
	});

	const usageQuery = useQuery({
		queryKey: ["adminUsage", usagePeriod],
		queryFn: () => api.admin.getUsage(usagePeriod),
		staleTime: 30_000,
		retry: noAuthRetry,
		enabled: activeTab === "usage" || activeTab === "overview",
	});

	const revenueQuery = useQuery({
		queryKey: ["adminRevenue", revenuePeriod],
		queryFn: () => api.admin.getRevenue(revenuePeriod),
		staleTime: 30_000,
		retry: noAuthRetry,
		enabled: activeTab === "revenue" || activeTab === "overview",
	});

	const keysQuery = useQuery({
		queryKey: ["adminKeys"],
		queryFn: () =>
			api.admin
				.getKeys(1, 100)
				.then((data) => (data as { keys?: ApiKey[] })?.keys ?? []),
		staleTime: 30_000,
		retry: noAuthRetry,
		enabled: activeTab === "keys" || activeTab === "overview",
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
			providerCosts: Object.fromEntries(
				usageStats.byProvider.map((p) => [p.provider, p.totalCost]),
			),
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

	// 403 = signed in but not an admin; 401 = not signed in at all. Without
	// the 401 branch an anonymous visitor saw the full admin shell (tabs,
	// layout, "No Data Available") instead of a gate — the backend never
	// leaked data, but the admin surface should not render for non-admins.
	const authGate = useMemo(() => {
		const errors = [
			usersQuery.error,
			usageQuery.error,
			revenueQuery.error,
			keysQuery.error,
		];
		if (errors.some((err) => err instanceof ApiError && err.status === 403)) {
			return "forbidden" as const;
		}
		if (errors.some((err) => err instanceof ApiError && err.status === 401)) {
			return "unauthenticated" as const;
		}
		return null;
	}, [usersQuery.error, usageQuery.error, revenueQuery.error, keysQuery.error]);

	if (authGate === "unauthenticated") {
		return (
			<div className="min-h-screen bg-void text-text flex flex-col items-center justify-center px-4">
				<div className="rounded border border-border bg-surface p-10 max-w-md w-full text-center">
					<div className="w-16 h-16 rounded border border-accent/30 bg-accent-dim flex items-center justify-center mx-auto mb-6">
						<ShieldAlert className="w-8 h-8 text-accent" />
					</div>
					<h1 className="text-xl font-bold font-display tracking-tight text-text-bright mb-2">
						Sign In Required
					</h1>
					<p className="text-sm text-text-muted font-mono mb-6">
						The admin console requires an authenticated administrator
						session.
					</p>
					<Link
						href="/login?next=%2Fadmin"
						className="inline-flex items-center gap-2 px-4 py-2 rounded border border-accent/40 bg-accent-dim text-accent hover:border-accent transition-colors text-sm font-mono"
					>
						Sign In
					</Link>
				</div>
			</div>
		);
	}

	if (authGate === "forbidden") {
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
						{TABS.map(({ id, Icon, href }) => (
							<button
								type="button"
								key={id}
								role="tab"
								id={`admin-tab-${id}`}
								aria-selected={!href && activeTab === id}
								aria-controls={href ? undefined : "admin-tabpanel"}
								onClick={() => selectTab(id, href)}
								className={`px-4 py-3 text-xs font-medium font-mono uppercase tracking-wider transition-all whitespace-nowrap rounded-lg ${
									!href && activeTab === id
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

			{activeTab === "audit-logs" && <AdminAuditLogsTab />}

			{activeTab === "dlq" && <AdminDlqTab />}

			{activeTab === "refunds" && <AdminRefundsTab />}

			{activeTab === "invoices" && <AdminInvoicesTab />}

			{activeTab === "surplus" && <AdminSurplusTab />}

			{activeTab === "polar" && <AdminPolarTab />}

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
