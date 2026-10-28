"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import nextDynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ErrorBoundary } from "@/components/error-boundary";
import { UnauthCallout } from "@/components/shared/UnauthCallout";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/hooks/useAuth";
import { type ApiKey, type ApiKeyCreateOptions, type ApiKeyWithSecret, api } from "@/lib/api";
import { log } from "@/lib/logger";
import { toDollars } from "@/lib/utils";
import { selectAvailableModels } from "@/lib/model-availability";
import { type TabId, type TimeRangeId } from "./_constants";
import { TABS } from "./_constants";
import { DashboardHeader } from "./_components/DashboardHeader";
import { useDashboardData } from "./_hooks/useDashboardData";
import { useDashboardKeyboard } from "./_hooks/useDashboardKeyboard";
import { useDashboardStats } from "./_hooks/useDashboardStats";
import { useUsageExport } from "./_hooks/useUsageExport";
import {
	DEMO_API_KEYS,
	DEMO_BALANCE,
	buildDemoTransactions,
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
	const { isDemo, user } = useAuth();
	const searchParams = useSearchParams();
	const demo = searchParams?.get("demo") === "1" || isDemo;
	// Private drafts and one-time secrets belong to the authenticated account,
	// including the state that supplies the child dashboard widgets.
	return <DashboardAccount key={demo ? "demo" : user?.id ?? "guest"} />;
}

function DashboardAccount() {
	const { isAuthenticated, isDemo, isReady, evmAddress, user } = useAuth();
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

	const [timeRange, setTimeRange] = useState<TimeRangeId>("7d");
	const [activeTab, setActiveTab] = useState<TabId>(initialTab);
	const live = useDashboardData({ isAuthenticated: canLoadDashboard, userId: user?.id, timeRange, analyticsEnabled: activeTab === "overview" || activeTab === "usage" });
	const demoUsage = useMemo(
		() => (isDemoView ? buildDemoUsage() : []),
		[isDemoView],
	);
	const demoTransactions = useMemo(() => buildDemoTransactions(demoUsage), [demoUsage]);
	const balance = isDemoView ? DEMO_BALANCE : live.balance;
	const apiKeys = isDemoView ? DEMO_API_KEYS : live.apiKeys;
	const usage = isDemoView ? demoUsage : live.usage;
	const models = isDemoView ? [] : live.models;
	const transactions = isDemoView ? demoTransactions : live.transactions;
	const loading = isDemoView ? false : live.loading;
	const error = isDemoView ? null : live.error;
	const backendUnavailable = isDemoView ? false : live.backendUnavailable;
	const refresh = live.refresh;
	const exportRange = live.summary ? { since: live.summary.from ?? undefined, until: live.summary.to } : null;
	const { exporting, exportUsage: handleExport } = useUsageExport({
		userId: user?.id, enabled: canLoadDashboard, range: exportRange,
		rangeLabel: timeRange === "all" ? "all time" : timeRange,
	});

	const [page, setPage] = useState(1);
	const [creating, setCreating] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null);
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const [copied, setCopied] = useState<string | null>(null);
	const [refreshTick, setRefreshTick] = useState(0);
	const accountCurrent = useRef(true);
	const keyRequest = useRef<AbortController | null>(null);
	useEffect(() => {
		accountCurrent.current = true;
		return () => {
			accountCurrent.current = false;
			keyRequest.current?.abort();
		};
	}, []);
	useEffect(() => { setPage(1); }, [timeRange, user?.id]);

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
		if (!canLoadDashboard) return;
		setPage(1);
		await refresh();
		setRefreshTick((n) => n + 1);
	}, [canLoadDashboard, refresh]);

	const handlePageChange = async (next: number) => {
		if (live.loadingMoreUsage) return;
		if (!isDemoView && next * RECENT_REQUESTS_LIMIT > usage.length && live.hasMoreUsage) {
			const result = await live.loadMoreUsage();
			if (result.isError) return;
		}
		setPage(next);
	};

	useDashboardKeyboard({
		setActiveTab: handleTabChange,
		setPage: updater => { void handlePageChange(updater(page)); },
		activeTab,
		page,
		hasMorePages: usage.length > page * RECENT_REQUESTS_LIMIT || (!isDemoView && live.hasMoreUsage),
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

	const handleCreateKey = useCallback(async (options: ApiKeyCreateOptions = {}) => {
		if (!canLoadDashboard || !newKeyName.trim() || keyRequest.current) return;
		const controller = new AbortController();
		keyRequest.current = controller;
		setCreating(true);
		try {
			const key = await api.auth.createKey(newKeyName.trim(), controller.signal, options);
			if (controller.signal.aborted || !accountCurrent.current) return;
			setCreatedKey(key);
			setNewKeyName("");
			setShowCreateForm(false);
			// Website chat uses the account session. Programmatic credentials
			// (including server-only IP restrictions) stay in the one-time modal.
			queryClient.setQueryData<{ keys: ApiKey[] }>(["apiKeys", user?.id], (prev) => ({
				keys: [
					...(prev?.keys ?? []),
					{
						id: key.id,
						name: key.name,
						prefix: key.prefix,
						createdAt: key.createdAt,
						lastUsedAt: key.lastUsedAt,
						expiresAt: key.expiresAt,
						allowedModels: key.allowedModels,
						ipAllowlist: key.ipAllowlist,
					},
				],
			}));
		} catch (e: unknown) {
			if (controller.signal.aborted || !accountCurrent.current) return;
			const msg = e instanceof Error ? e.message : "Failed to create key";
			toast.error(msg);
		} finally {
			if (keyRequest.current === controller) {
				keyRequest.current = null;
				if (accountCurrent.current) setCreating(false);
			}
		}
	}, [canLoadDashboard, newKeyName, queryClient, toast, user?.id]);

	const handleRevokeKey = useCallback(
		async (keyId: string) => {
			setRevokingId(keyId);
			try {
				await api.auth.deleteKey(keyId);
				if (!accountCurrent.current) return;
				queryClient.setQueryData<{ keys: ApiKey[] }>(["apiKeys", user?.id], (prev) => ({
					keys: (prev?.keys ?? []).filter((k) => k.id !== keyId),
				}));
			} catch (e: unknown) {
				if (!accountCurrent.current) return;
				const msg = e instanceof Error ? e.message : "Failed to revoke key";
				toast.error(msg);
			} finally {
				if (accountCurrent.current) setRevokingId(null);
			}
		},
		[queryClient, toast, user?.id],
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
		<UnauthCallout variant="dashboard" />
	) : (
		<div>
			<div
				id="dashboard-content"
				className="bg-void text-text-secondary selection:bg-surface selection:text-text"
			>
				{depositSuccess && (
					<div
						role="status"
						className="flex flex-wrap items-center justify-between gap-3 border-b border-success/30 bg-success/10 px-4 py-2 sm:px-6 lg:px-8 text-[11px] font-mono text-success"
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
				{isDemoView && activeTab !== "settings" && (
					<div
						role="status"
						className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/25 bg-accent/10 px-4 py-2 sm:px-6 lg:px-8 text-[11px] font-mono text-accent"
					>
						<span className="uppercase tracking-wider">
							Demo tour · sample account data (read-only)
						</span>
						<Link
							href={isAuthenticated && !isDemo ? `/dashboard?tab=${activeTab}` : "/login?next=/dashboard"}
							className="shrink-0 rounded-[var(--radius-sm)] bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-void hover:bg-accent-bright"
						>
							{isAuthenticated && !isDemo ? "Exit demo" : "Sign in for live data"}
						</Link>
					</div>
				)}
				{evmAddress && !isDemoView && (
					<div
						role="status"
						className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/25 bg-accent/10 px-4 py-2 sm:px-6 lg:px-8 text-[11px] font-mono text-accent"
					>
						<span className="uppercase tracking-wider">
							Wallet connected · {evmAddress.slice(0, 6)}…{evmAddress.slice(-4)}
						</span>
						<Link
							href="/dashboard?tab=settings"
							className="shrink-0 rounded-[var(--radius-sm)] bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-void hover:bg-accent-bright"
						>
							Manage
						</Link>
					</div>
				)}
				<div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
					<DashboardHeader
						loading={loading}
						modelsAvailable={selectAvailableModels(models).length}
						hasAnyData={hasAnyData}
						isDemo={isDemoView}
						refreshTick={refreshTick}
						hasError={!!error}
						onRefresh={canLoadDashboard ? handleRefresh : undefined}
						onExport={handleExport}
						exporting={exporting}
						exportDisabled={!canLoadDashboard || !exportRange}
						activeTab={activeTab}
						onTabChange={handleTabChange}
						timeRange={timeRange}
						onTimeRangeChange={setTimeRange}
						notificationsEnabled={canLoadDashboard}
					/>

					<DashboardGrid
						key={isDemoView ? "demo" : user?.id ?? "guest"}
						ownerId={user?.id}
						balance={balance}
						apiKeys={apiKeys}
						usage={isDemoView ? filteredUsage : usage}
						hasAnyUsage={isDemoView ? usage.length > 0 : (live.summary?.lifetimeRequests ?? 0) > 0}
						transactions={transactions}
						isDemo={isDemoView}
						loading={loading}
						error={error}
						backendUnavailable={backendUnavailable}
						summary={isDemoView ? null : live.summary}
						todayRequests={isDemoView ? todayUsage.length : live.summary?.last24h.requests ?? 0}
						todayCost={isDemoView ? todayCost : toDollars(live.summary?.last24h.billed_cents)}
						activeModels={isDemoView ? activeModels : live.summary?.last24h.active_models ?? 0}
						totalTokens={isDemoView ? totalTokens : (live.summary?.last24h.input_tokens ?? 0) + (live.summary?.last24h.output_tokens ?? 0)}
						avgLatencyMs={isDemoView ? avgLatency : live.summary?.last24h.avg_latency_ms ?? 0}
						errorCount={isDemoView ? todayErrorCount : live.summary?.last24h.errors ?? 0}
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
						onPageChange={handlePageChange}
						hasMoreUsage={!isDemoView && live.hasMoreUsage}
						loadingMoreUsage={live.loadingMoreUsage}
						createdKey={createdKey}
						onDismissCreatedKey={() => setCreatedKey(null)}
						onRefresh={handleRefresh}
						activeTab={activeTab}
						timeRange={timeRange}
						onNavigateToApiKeys={handleNavigateToApiKeys}
						walletConnected={Boolean(evmAddress)}
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
