"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthSkeleton } from "@/components/auth/AuthSkeleton";
import { ConnectWalletView } from "@/components/dashboard/ConnectWalletView";
import { ErrorBoundary } from "@/components/error-boundary";
import { useToast } from "@/components/ui/Toast";
import { useWallet } from "@/components/wallet-provider";
import { type ApiKey, type ApiKeyWithSecret, api } from "@/lib/api";
import { log } from "@/lib/logger";
import { type TabId, type TimeRangeId } from "./_constants";
import { TABS } from "./_constants";
import { DashboardHeader } from "./_components/DashboardHeader";
import { useDashboardData } from "./_hooks/useDashboardData";
import { useDashboardKeyboard } from "./_hooks/useDashboardKeyboard";
import { useDashboardStats } from "./_hooks/useDashboardStats";

// Lazy-load the 599-line grid + chart components. Initial paint shows
// the header + skeleton; the grid hydrates after data is fetched.
const DashboardGrid = dynamic(
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
						className="h-32 animate-pulse rounded-lg bg-surface-elevated/40"
					/>
				))}
			</div>
		),
	},
);

const RECENT_REQUESTS_LIMIT = 20;

export default function DashboardPage() {
	const { isAuthenticated, isDemo, connectEvm, isReady } = useWallet();
	const toast = useToast();
	const queryClient = useQueryClient();
	const searchParams = useSearchParams();

	// Sync the active tab with ?tab=... in the URL. Validates against the
	// TABS list so unknown values fall back to "overview" instead of
	// showing a blank page. Allows deep-links like /dashboard?tab=health.
	// TABS is a module-level constant — memoize once so the effect deps are stable.
	const validTabIds = useMemo(() => TABS.map((t) => t.id), []);
	const initialTab: TabId =
		(searchParams.get("tab") &&
		validTabIds.includes(searchParams.get("tab") as TabId))
			? (searchParams.get("tab") as TabId)
			: "overview";

	const {
		balance,
		apiKeys,
		usage,
		creditBatches,
		models,
		transactions,
		loading,
		error,
		backendUnavailable,
		refresh,
	} = useDashboardData({ isAuthenticated, isDemo });

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

	// Keep tab state in sync with ?tab= (back/forward + deep links).
	useEffect(() => {
		const raw = searchParams.get("tab");
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

	// All dashboard aggregates (today/month deltas, filtered ranges, error
	// counts, latency avg, etc.) are derived in this hook so the page can
	// stay focused on data fetching and UI wiring.
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
		if (isDemo) {
			toast.error("Demo mode is read-only — sign in to create API keys");
			return;
		}
		setCreating(true);
		try {
			const key = await api.auth.createKey(newKeyName.trim());
			setCreatedKey(key);
			setNewKeyName("");
			setShowCreateForm(false);
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
	}, [isDemo, newKeyName, queryClient, toast]);

	const handleRevokeKey = useCallback(
		async (keyId: string) => {
			if (isDemo) {
				toast.error("Demo mode is read-only — sign in to manage keys");
				return;
			}
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
		[isDemo, queryClient, toast],
	);

	const hasAnyData = Boolean(balance) || apiKeys.length > 0 || usage.length > 0;

	const handleNavigateToApiKeys = useCallback(() => {
		handleTabChange("api-keys");
		setShowCreateForm(true);
	}, [handleTabChange]);

	// Wait for session restore before the sign-in wall. If meta/session is
	// already known (middleware seeds oma_session_meta), show the app even
	// while /api/user is still finishing — only block when we truly don't know.
	const content = !isReady && !isAuthenticated ? (
		<>
			<h1 className="sr-only">Dashboard</h1>
			<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
				<AuthSkeleton />
			</div>
		</>
	) : !isAuthenticated ? (
		<>
			<h1 className="sr-only">Dashboard</h1>
			<ConnectWalletView onConnect={connectEvm} />
		</>
	) : (
		<div>
			<div
				id="dashboard-content"
				className="bg-void text-text-secondary selection:bg-surface selection:text-text"
			>
				{isDemo && (
					<div
						role="status"
						className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/25 bg-accent/10 px-4 py-2 text-[11px] font-mono text-accent md:px-8"
					>
						<span className="uppercase tracking-wider">
							Demo mode — mock data only. Sign in to use real credits &amp; keys.
						</span>
						<a
							href="/login?next=/dashboard"
							className="shrink-0 rounded bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-void hover:bg-accent-bright"
						>
							Sign in →
						</a>
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
					/>

					<DashboardGrid
						balance={balance}
						apiKeys={apiKeys}
						usage={filteredUsage}
						creditBatches={creditBatches}
						transactions={transactions}
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
						Something went wrong loading the dashboard.
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
