"use client";

import { useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useWallet } from "@/components/wallet-provider";
import { type ApiKey, type ApiKeyWithSecret, api } from "@/lib/api";
import { DashboardGrid } from "./_components/DashboardGrid";
import { DashboardHeader } from "./_components/DashboardHeader";
import { useDashboardData } from "./_hooks/useDashboardData";
import { useDashboardStats } from "./_hooks/useDashboardStats";

const LazyConnectWalletView = dynamic(
	() =>
		import("@/components/dashboard/ConnectWalletView").then(
			(mod) => mod.ConnectWalletView,
		),
	{ ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
);

const RECENT_REQUESTS_LIMIT = 20;

export default function DashboardPage() {
	const { isAuthenticated, connectEvm } = useWallet();
	const toast = useToast();
	const queryClient = useQueryClient();

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
	} = useDashboardData({ isAuthenticated });

	const [page, setPage] = useState(1);
	const [creating, setCreating] = useState(false);
	const [newKeyName, setNewKeyName] = useState("");
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [createdKey, setCreatedKey] = useState<ApiKeyWithSecret | null>(null);
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const [copied, setCopied] = useState<string | null>(null);
	const [refreshTick, setRefreshTick] = useState(0);
	const [activeTab, setActiveTab] = useState("overview");
	const [timeRange, setTimeRange] = useState("7d");

	// Stable ref to handleRefresh so the keyboard handler (defined below the
	// callback) can call it without re-binding the effect on every render.
	// The ref is reassigned in a useEffect once the callback exists.
	const handleRefreshRef = useRef<() => Promise<void>>(async () => {});

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

	useEffect(() => {
		// Keyboard shortcuts. Active on all tabs but only when the user isn't
		// typing in an input/textarea/contenteditable. Shortcuts:
		//   R         — refresh dashboard
		//   1 / 2 / 3 / 4 — switch to Overview / Usage / API keys / Health
		//   ArrowLeft / ArrowRight (Usage tab only) — paginate recent-requests
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (target) {
				const tag = target.tagName;
				if (
					tag === "INPUT" ||
					tag === "TEXTAREA" ||
					tag === "SELECT" ||
					target.isContentEditable
				) {
					return;
				}
			}
			// Modifier-bearing keys are reserved for the browser (Cmd+R, etc.)
			if (e.metaKey || e.ctrlKey || e.altKey) return;

			if (e.key === "r" || e.key === "R") {
				e.preventDefault();
				handleRefreshRef.current();
				return;
			}
			if (e.key === "1") {
				e.preventDefault();
				setActiveTab("overview");
				return;
			}
			if (e.key === "2") {
				e.preventDefault();
				setActiveTab("usage");
				return;
			}
			if (e.key === "3") {
				e.preventDefault();
				setActiveTab("api-keys");
				return;
			}
			if (e.key === "4") {
				e.preventDefault();
				setActiveTab("health");
				return;
			}
			if (activeTab === "usage") {
				if (e.key === "ArrowLeft" && page > 1) {
					setPage((p) => p - 1);
				} else if (
					e.key === "ArrowRight" &&
					usage.length > page * RECENT_REQUESTS_LIMIT
				) {
					setPage((p) => p + 1);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [page, usage.length, activeTab]);

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
					console.error("Failed to copy:", err);
					toast.error(
						"Failed to copy to clipboard. Please check your browser permissions.",
					);
				});
		},
		[toast],
	);

	const handleRefresh = useCallback(async () => {
		setRefreshTick((n) => n + 1);
		await refresh();
	}, [refresh]);

	// Keep the ref pointing at the latest callback so the keyboard handler
	// (defined above) can invoke it. Runs on every render where the callback
	// identity changes.
	useEffect(() => {
		handleRefreshRef.current = handleRefresh;
	}, [handleRefresh]);

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

	const content = !isAuthenticated ? (
		<>
			<h1 className="sr-only">Dashboard</h1>
			<LazyConnectWalletView onConnect={connectEvm} />
		</>
	) : (
		<div>
			<div
				id="dashboard-content"
				className="bg-void text-text-secondary selection:bg-surface selection:text-text"
			>
				<div className="p-4 md:p-8 pt-4">
					<DashboardHeader
						loading={loading}
						modelsAvailable={models.length}
						hasAnyData={hasAnyData}
						refreshTick={refreshTick}
						onRefresh={handleRefresh}
						onExport={handleExport}
						activeTab={activeTab}
						onTabChange={setActiveTab}
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
