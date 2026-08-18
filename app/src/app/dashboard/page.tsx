"use client";



import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import nextDynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ErrorBoundary } from "@/components/error-boundary";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/hooks/useAuth";
import { type ApiKey, type ApiKeyWithSecret, api } from "@/lib/api";
import { log } from "@/lib/logger";
import { type TabId, type TimeRangeId } from "./_constants";
import { TABS } from "./_constants";
import { DashboardHeader } from "./_components/DashboardHeader";
import { useDashboardData } from "./_hooks/useDashboardData";
import { useDashboardKeyboard } from "./_hooks/useDashboardKeyboard";
import { useDashboardStats } from "./_hooks/useDashboardStats";
import {
	DEMO_API_KEYS,
	DEMO_BALANCE,
	DEMO_BATCHES,
	DEMO_TRANSACTIONS,
	buildDemoUsage,
} from "./_lib/demo-data";

const DashboardGrid = nextDynamic(
	() =>
		import("./_components/DashboardGrid").then((m) => ({
			default: m.DashboardGrid,
		})),
	{
		loading: () => (
			<div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<div
						key={i}
						className="h-32 animate-pulse rounded-[var(--radius-lg)] bg-surface-elevated/40"
					/>
				))}
			</div>
		),
	},
);

const RECENT_REQUESTS_LIMIT = 20;

/** Inline auth-loading skeleton — replaces the deleted AuthSkeleton. */
function AuthGateSkeleton() {
	return (
		<div className="flex items-center justify-center px-4">
			<div className="w-full max-w-md space-y-3">
				<div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-surface-elevated/60" />
				<div className="mx-auto h-4 w-48 animate-pulse rounded-[var(--radius-sm)] bg-surface-elevated/40" />
				<div className="mx-auto h-3 w-32 animate-pulse rounded-[var(--radius-sm)] bg-surface-elevated/30" />
			</div>
		</div>
	);
}

export default function DashboardPage() {
	return (
		<Suspense fallback={<AuthGateSkeleton />}>
			<DashboardPageInner />
		</Suspense>
	);
}

function DashboardPageInner() {
	const { isAuthenticated, isDemo, isReady, evmAddress, isAdmin } = useAuth();
	const toast = useToast();
	const queryClient = useQueryClient();
	const searchParams = useSearchParams();
	const isDemoView = searchParams?.get("demo") === "1" || isDemo;
	const depositSuccess = searchParams?.get("deposit") === "success";
	const canLoadDashboard = isReady && isAuthenticated && !isDemoView;

	const validTabIds = useMemo(() => TABS.map((t) => t.id), []);
	const initialTab: TabId =
		(searchParams?.get("tab") && validTabIds.includes(searchParams?.get("tab") as TabId))
			? (searchParams?.get("tab") as TabId)
			: "overview";

	const live = useDashboardData({ isAuthenticated: canLoadDashboard });
	const demoUsage = useMemo(
		() => (isDemoView ? buildDemoUsage() : []),
		[isDemoView],
	);
	const balance = isDemoView ? DEMO_BALANCE : live.balance;
	const apiKeys = isDemoView ? DEMO_API_KEYS : live.apiKeys;
	const usage = isDemoView ? demoUsage : live.usage;
	const creditBatches = isDemoView ? DEMO_BATCHES : live.creditBatches;
	const models = isDemoView ? [] : live.models;
	const transactions = isDemoView ? DEMO_TRANSACTIONS : live.transactions;
	const loading = isDemoView ? false : live.loading;
	const error = isDemoView ? null : live.error;
	const backendUnavailable = isDemoView ? false : live.backendUnavailable;
	const refresh = live.refresh;

	const [page, setPage] = useState(1);
	const [creating, setCreating] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null);
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const [copied, setCopied] = useState<string | null>(null);
	const [refreshTick, setRefreshTick] = useState(0);
	const [activeTab, setActiveTab] = useState<TabId>(initialTab);
	const [timeRange, setTimeRange] = useState<TimeRangeId>("7d");

	useEffect(() => {
		const raw = searchParams?.get("tab");
		const next =
			raw && validTabIds.includes(raw as TabId) ? (raw as TabId) : "overview";
		setActiveTab(next);
	}, [searchParams, validTabIds]);

	const handleTabChange = useCallback((tab: TabId) => {
		setActiveTab(tab);
		if (typeof window === "undefined") return;
		const url = new URL(window.location.href);
		if (tab === "overview") url.searchParams.delete("tab");
		else url.searchParams.set("tab", tab);
		window.history.replaceState({}, "", url.toString());
	}, []);

	const {
		todayUsage,
		filteredUsage,
		todayCost,
		totalTokens,
		todayErrorCount,
		avgLatency,
		activeModels,
	} = useDashboardStats(usage, timeRange);

	const handleRefresh = useCallback(async () => {
		setRefreshTick((n) => n + 1);
		await refresh();
	}, [refresh]);

	useDashboardKeyboard({
		setActiveTab: handleTabChange,
		setPage,
		activeTab,
		page,
		hasMorePages: usage.length > page * RECENT_REQUESTS_LIMIT,
		onRefresh: handleRefresh,
	});

	const handleCopy = useCallback(
		(text: string, id: string) => {
			navigator.clipboard
				.writeText(text)
				.then(() => {
					toast.success("Copied to clipboard");
					setCopied(id);
					setTimeout(() => setCopied(null), 2000);
				})
				.catch((err) => {
					log.error("Failed to copy:", err);
					toast.error(
						"Failed to copy to clipboard. Please check your browser permissions.",
					);
				});
		},
		[toast],
	);

	const handleExport = useCallback(async () => {
		try {
			const blob = await api.exportData.usage("csv");
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `oma-usage-${new Date().toISOString().slice(0, 10)}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			toast.success("Usage data exported");
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : "Export failed");
		}
	}, [toast]);

	const handleCreateKey = useCallback(async () => {
		if (!newKeyName.trim()) return;
		setCreating(true);
		try {
			const key = await api.auth.createKey(newKeyName.trim());
			setCreatedKey(key);
			setNewKeyName("");
			setShowCreateForm(false);
			// Install the raw key as the HttpOnly oma_api_key cookie so the
			// browser-direct SSE chat can authenticate against the backend.
			// Don't silently swallow failures — surface a toast so users
			// know if their browser blocked the cookie write.
			api.auth.installKeyCookie(key.key).catch((err) => {
				toast.error(
					"Couldn't store your API key cookie. If chat doesn't load, check browser cookie settings.",
				);
				log.error("installKeyCookie failed", err);
			});
			queryClient.setQueryData<ApiKey[]>(["apiKeys"], (prev) => [
				...(prev ?? []),
				{
					id: key.id,
					name: key.name,
					prefix: key.prefix,
					createdAt: key.createdAt,
					lastUsedAt: key.lastUsedAt,
				},
			]);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : "Failed to create key";
			toast.error(msg);
		} finally {
			setCreating(false);
		}
	}, [newKeyName, queryClient, toast]);

	const handleRevokeKey = useCallback(
		async (keyId: string) => {
			setRevokingId(keyId);
			try {
				await api.auth.deleteKey(keyId);
				queryClient.setQueryData<ApiKey[]>(["apiKeys"], (prev) =>
					(prev ?? []).filter((k) => k.id !== keyId),
				);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : "Failed to revoke key";
				toast.error(msg);
			} finally {
				setRevokingId(null);
			}
		},
		[queryClient, toast],
	);

	const hasAnyData = Boolean(balance) || apiKeys.length > 0 || usage.length > 0;

	const handleNavigateToApiKeys = useCallback(() => {
		handleTabChange("api-keys");
		setShowCreateForm(true);
	}, [handleTabChange]);

	// Demo tours (`?demo=1`) must not wait on Better Auth session resolution.
	const content = !isReady && !isDemoView ? (
		<AuthGateSkeleton />
	) : !isAuthenticated && !isDemoView ? (
		<div className="flex min-h-full flex-col items-center justify-center gap-6 px-4 py-16">
			<h2 className="sr-only">Dashboard</h2>
			<div className="surface-card w-full max-w-md p-8 text-center">
				<p className="font-mono text-xs uppercase tracking-widest text-accent">
					Sign in required
				</p>
				<h1 className="mt-2 text-2xl font-bold tracking-tight text-text-bright">
					Keys, usage, credits
				</h1>
				<p className="mt-2 text-sm text-text-secondary">
					Sign in to manage API keys, see live credit balance, and review inference usage.
				</p>
				<div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
					<Link
						href="/login?next=/dashboard"
						className="btn-mono btn-primary"
					>
						Sign in
					</Link>
					<Link
						href="/deposit"
						className="btn-mono"
					>
						Deposit USDC
					</Link>
				</div>
			</div>
		</div>
	) : (
		<div>
			<div
				id="dashboard-content"
				className="bg-void text-text-secondary selection:bg-surface selection:text-text"
			>
				{depositSuccess && (
					<div
						role="status"
						className="flex flex-wrap items-center justify-between gap-3 border-b border-success/30 bg-success/10 px-4 py-2 text-[11px] font-mono text-success md:px-8"
					>
						<span className="uppercase tracking-wider">
							Payment received · credits appear after Polar confirms
						</span>
						<Link
							href="/dashboard"
							className="shrink-0 rounded-[var(--radius-sm)] border border-success/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider hover:bg-success/15"
						>
							Dismiss
						</Link>
					</div>
				)}
				{isDemoView && (
					<div
						role="status"
						className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/25 bg-accent/10 px-4 py-2 text-[11px] font-mono text-accent md:px-8"
					>
						<span className="uppercase tracking-wider">
							Demo tour · sample charts &amp; balances (read-only)
						</span>
						<Link
							href="/login?next=/dashboard"
							className="shrink-0 rounded-[var(--radius-sm)] bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-void hover:bg-accent-bright"
						>
							Sign in for live data →
						</Link>
					</div>
				)}
				{evmAddress && !isDemoView && (
					<div
						role="status"
						className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/25 bg-accent/10 px-4 py-2 text-[11px] font-mono text-accent md:px-8"
					>
						<span className="uppercase tracking-wider">
							Wallet connected · {evmAddress.slice(0, 6)}…{evmAddress.slice(-4)}
						</span>
						<Link
							href="/settings"
							className="shrink-0 rounded-[var(--radius-sm)] bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-void hover:bg-accent-bright"
						>
							Manage →
						</Link>
					</div>
				)}
				<div className="p-4 md:p-8 pt-4">
					<DashboardHeader
						loading={loading}
						modelsAvailable={models.length}
						hasAnyData={hasAnyData}
						refreshTick={refreshTick}
						onRefresh={handleRefresh}
						onExport={handleExport}
						activeTab={activeTab}
						onTabChange={handleTabChange}
						timeRange={timeRange}
						onTimeRangeChange={setTimeRange}
						notificationsEnabled={canLoadDashboard}
						isAdmin={isAdmin}
					/>

					<DashboardGrid
						balance={balance}
						apiKeys={apiKeys}
						usage={filteredUsage}
						hasAnyUsage={usage.length > 0}
						creditBatches={creditBatches}
						transactions={transactions}
						isDemo={isDemoView}
						loading={loading}
						error={error}
						backendUnavailable={backendUnavailable}
						todayRequests={todayUsage.length}
						todayCost={todayCost}
						activeModels={activeModels}
						totalTokens={totalTokens}
						avgLatencyMs={avgLatency}
						errorCount={todayErrorCount}
						creating={creating}
						showCreateForm={showCreateForm}
						newKeyName={newKeyName}
						copied={copied}
						revokingId={revokingId}
						onCopy={handleCopy}
						onCreateKey={handleCreateKey}
						onRevokeKey={handleRevokeKey}
						setShowCreateForm={setShowCreateForm}
						setNewKeyName={setNewKeyName}
						page={page}
						limit={RECENT_REQUESTS_LIMIT}
						onPageChange={setPage}
						createdKey={createdKey}
						onDismissCreatedKey={() => setCreatedKey(null)}
						onRefresh={handleRefresh}
						activeTab={activeTab}
						timeRange={timeRange}
						onNavigateToApiKeys={handleNavigateToApiKeys}
						walletConnected={Boolean(evmAddress)}
						isAdmin={isAdmin}
					/>
				</div>
			</div>
		</div>
	);

	return (
		<ErrorBoundary
			fallback={
				<div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
					<h2 className="font-mono text-text text-lg">Dashboard Error</h2>
					<p className="text-sm text-text-muted max-w-md font-mono">
						The dashboard could not load. Retry, or check that the API server is reachable.
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