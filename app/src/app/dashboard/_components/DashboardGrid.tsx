"use client";

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import {
	Activity,
	Inbox,
	KeyRound,
	type LucideIcon,
	RefreshCw,
	WifiOff,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Suspense, useMemo, useState } from "react";
import { CreditBalanceCard } from "@/components/dashboard/CreditBalanceCard";
import { ErrorBoundary } from "@/components/error-boundary";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
	ApiKey,
	ApiKeyWithSecret,
	BalanceResponse,
	CreditBatch,
	CreditTransaction,
	UsageRecord,
} from "@/lib/api";
import {
	mapUsageToChartData,
	mapUsageToModelData,
} from "@/lib/api/usage-chart";
import type { TabId, TimeRangeId } from "../_constants";
import { QuickActions } from "./QuickActions";
import { QuickStatsCard } from "./QuickStatsCard";
import { RecentTransactions } from "./RecentTransactions";

const tabContentVariants = {
	hidden: { opacity: 0, y: 8 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.25, ease: "easeOut" as const },
	},
	exit: {
		opacity: 0,
		y: -8,
		transition: { duration: 0.15, ease: "easeIn" as const },
	},
};

/**
 * Empty state with icon, copy, and optional action. The icon defaults to
 * Inbox when none is supplied — call sites pass a Lucide icon that matches
 * the data the user expected to see (Activity for usage, KeyRound for API
 * keys, BarChart3 for charts/health).
 */
function EmptyState({
	title,
	description,
	action,
	icon: Icon = Inbox,
}: {
	title: string;
	description: string;
	action?: React.ReactNode;
	// Loose type so any Lucide icon (which has a different forwardRef'd
	// signature) is assignable here.
	icon?: LucideIcon;
}) {
	return (
		<m.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className="flex flex-col items-center justify-center py-16 px-6 text-center"
		>
			<div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-text-muted mb-4">
				<Icon className="h-5 w-5" aria-hidden="true" />
			</div>
			<h3 className="text-text-bright text-lg font-medium mb-2">{title}</h3>
			<p className="text-text-secondary text-sm max-w-md mb-6">{description}</p>
			{action}
		</m.div>
	);
}
const LazyExpiringCreditsWarning = dynamic(
	() =>
		import("@/components/dashboard/ExpiringCreditsWarning").then(
			(mod) => mod.ExpiringCreditsWarning,
		),
	{ ssr: false, loading: () => <Skeleton className="h-20 w-full" /> },
);

const LazyProviderHealthSummary = dynamic(
	() =>
		import("@/components/dashboard/ProviderHealthSummary").then(
			(mod) => mod.ProviderHealthSummary,
		),
	{
		ssr: false,
		loading: () => (
			<div className="flex min-h-[12rem] flex-col bg-void p-6">
				<Skeleton className="mb-2 h-4 w-28" />
				<Skeleton className="mb-6 h-3 w-40" />
				<Skeleton className="mb-2 h-4 w-32" />
				<div className="space-y-2 border border-border p-2">
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
				</div>
			</div>
		),
	},
);
const LazyUsageChart = dynamic(
	() =>
		import("@/components/dashboard/UsageChart").then((mod) => mod.UsageChart),
	{
		ssr: false,
		loading: () => (
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border">
				<div className="bg-void p-6">
					<Skeleton className="h-4 w-20 mb-4" />
					<Skeleton className="h-[300px] w-full" />
				</div>
				<div className="bg-void p-6">
					<Skeleton className="h-4 w-24 mb-4" />
					<Skeleton className="h-[280px] w-full" />
				</div>
			</div>
		),
	},
);
const LazyProviderHealthCard = dynamic(
	() =>
		import("@/components/dashboard/ProviderHealthCard").then(
			(mod) => mod.ProviderHealthCard,
		),
	{ ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);
const LazyApiKeyManager = dynamic(
	() =>
		import("@/components/dashboard/ApiKeyManager").then(
			(mod) => mod.ApiKeyManager,
		),
	{ ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
);
const LazyRecentRequestsTable = dynamic(
	() =>
		import("@/components/dashboard/RecentRequestsTable").then(
			(mod) => mod.RecentRequestsTable,
		),
	{ ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);
const LazyModelUsageTable = dynamic(
	() =>
		import("@/components/dashboard/ModelUsageTable").then(
			(mod) => mod.ModelUsageTable,
		),
	{ ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);
const LazyProviderBreakdown = dynamic(
	() =>
		import("@/components/dashboard/ProviderBreakdown").then(
			(mod) => mod.ProviderBreakdown,
		),
	{ ssr: false, loading: () => <Skeleton className="h-48 w-full" /> },
);
const LazyCreatedKeyModal = dynamic(
	() =>
		import("@/components/dashboard/CreatedKeyModal").then(
			(mod) => mod.CreatedKeyModal,
		),
	{ ssr: false, loading: () => null },
);

/** Wraps a lazy component in a mini error boundary so one failing widget
 *  doesn't crater the whole dashboard. */
function WidgetErrorBoundary({
	children,
	title,
}: {
	children: React.ReactNode;
	title?: string;
}) {
	return (
		<ErrorBoundary
			fallback={
				<div className="rounded-lg border border-error/20 bg-error/5 p-4 text-center">
					<p className="text-xs text-error font-medium">
						{title ?? "Widget"} failed to load
					</p>
					<p className="text-[10px] text-text-muted mt-1">
						Refresh the page to retry
					</p>
				</div>
			}
		>
			{children}
		</ErrorBoundary>
	);
}

interface DashboardGridProps {
	// Aggregated dashboard data (resolved by `useDashboardData`).
	balance: BalanceResponse | null;
	apiKeys: ApiKey[];
	usage: UsageRecord[];
	creditBatches: CreditBatch[];
	transactions: CreditTransaction[];
	loading: boolean;
	error: string | null;
	backendUnavailable: boolean;

	// Derived QuickStats inputs.
	todayRequests: number;
	todayCost: number;
	activeModels: number;
	/** Total tokens consumed today (prompt + completion). */
	totalTokens?: number;
	/** Average request latency in ms (today). */
	avgLatencyMs?: number;
	/** Today's failed-request count. */
	errorCount?: number;

	// API key manager state + callbacks.
	creating: boolean;
	showCreateForm: boolean;
	newKeyName: string;
	copied: string | null;
	revokingId: string | null;
	onCopy: (text: string, id: string) => void;
	onCreateKey: () => void;
	onRevokeKey: (keyId: string) => void;
	setShowCreateForm: (show: boolean) => void;
	setNewKeyName: (name: string) => void;

	// Recent requests pagination.
	page: number;
	limit: number;
	onPageChange: (page: number) => void;

	// Created-key modal state.
	createdKey: ApiKeyWithSecret | null;
	onDismissCreatedKey: () => void;

	// Refresh callback for the error banner RETRY / CLEAR buttons.
	onRefresh: () => void;

	// Active tab for tabbed navigation.
	activeTab?: TabId;

	// Time range for analytics charts.
	timeRange?: TimeRangeId;

	// Onboarding callback: navigate to API Keys tab.
	onNavigateToApiKeys?: () => void;
}

/**
 * Main dashboard layout with tabbed navigation. Renders different content
 * based on the active tab:
 * - Overview: balance, expiring credits, quick stats, usage charts, recent transactions
 * - Usage: usage charts + recent requests table
 * - API Keys: API key manager
 * - Health: provider health card
 */
export function DashboardGrid(props: DashboardGridProps) {
	const {
		balance,
		apiKeys,
		usage,
		creditBatches,
		transactions,
		loading,
		error,
		backendUnavailable,
		todayRequests,
		todayCost,
		activeModels,
		totalTokens = 0,
		avgLatencyMs = 0,
		errorCount = 0,
		creating,
		showCreateForm,
		newKeyName,
		copied,
		revokingId,
		onCopy,
		onCreateKey,
		onRevokeKey,
		setShowCreateForm,
		setNewKeyName,
		page,
		limit,
		onPageChange,
		createdKey,
		onDismissCreatedKey,
		onRefresh,
		activeTab = "overview",
		timeRange = "7d",
		onNavigateToApiKeys,
	} = props;

	const [errorDismissed, setErrorDismissed] = useState(false);

	// `usage` is already time-range filtered by the page (`filteredUsage`).
	// Pass `null` so mapUsageToChartData does not re-slice to a hard-coded 7d
	// window (which would break the 30d / all-time range selectors).
	const usageData = useMemo(
		() => mapUsageToChartData(usage ?? [], null),
		[usage],
	);
	const modelData = useMemo(() => mapUsageToModelData(usage ?? []), [usage]);

	return (
		<>
			{error && !errorDismissed && (
				<div
					role="alert"
					aria-live="polite"
					className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-error/30 bg-error/5 p-4"
				>
					<div className="flex items-center gap-3 text-sm text-text">
						{backendUnavailable ? (
							<>
								<WifiOff className="h-4 w-4 shrink-0 text-error" />
								<div>
									<div className="font-medium text-error">
										Backend unavailable
									</div>
									<div className="text-xs text-text-muted mt-0.5">
										Make sure the API server is reachable (configured via NEXT_PUBLIC_API_URL).
									</div>
								</div>
							</>
						) : (
							<>
								<span className="inline-block h-2 w-2 shrink-0 rounded-full bg-error animate-pulse" />
								<span>
									<span className="font-medium text-error">
										Something went wrong.
									</span>{" "}
									<span className="text-text-muted">{error}</span>
								</span>
							</>
						)}
					</div>
					<div className="flex shrink-0 items-center gap-2">
						{backendUnavailable && (
							<button
								type="button"
								onClick={onRefresh}
								className="inline-flex items-center gap-1.5 rounded-lg border border-error/40 bg-error/10 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
							>
								<RefreshCw className="h-3 w-3" />
								Retry
							</button>
						)}
						<button
							type="button"
							onClick={() => setErrorDismissed(true)}
							className="rounded-lg border border-border bg-void px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							Dismiss
						</button>
					</div>
				</div>
			)}

			<AnimatePresence mode="wait">
				{/* Overview Tab */}
				{activeTab === "overview" && (
					// No opacity-0 entrance on overview — first paint must never be a
					// blank void while data is still syncing (looked broken in screenshots).
					<div
						key="overview"
						id="panel-overview"
						role="tabpanel"
						aria-labelledby="tab-overview"
						aria-label="Overview"
					>
						{/* Onboarding checklist for new users */}
						{!loading && (
							<OnboardingChecklist
								walletConnected={true}
								hasApiKey={apiKeys.length > 0}
								hasUsage={usage.length > 0}
								onNavigateToApiKeys={onNavigateToApiKeys}
							/>
						)}

						{creditBatches && creditBatches.length > 0 && (
							<div className="mb-4">
								<WidgetErrorBoundary title="Expiring credits">
									<LazyExpiringCreditsWarning creditBatches={creditBatches} />
								</WidgetErrorBoundary>
							</div>
						)}

						<div className="mb-6 grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-h-[12rem] [&>*]:bg-void">
							<WidgetErrorBoundary title="Balance">
								<CreditBalanceCard
									balance={balance}
									loading={loading}
									recentUsage={usage}
								/>
							</WidgetErrorBoundary>
							<WidgetErrorBoundary title="Today's stats">
								<QuickStatsCard
									loading={loading}
									todayRequests={todayRequests}
									todayCost={todayCost}
									totalTokens={totalTokens}
									avgLatencyMs={avgLatencyMs}
									errorCount={errorCount}
									activeModels={activeModels}
								/>
							</WidgetErrorBoundary>
							<div className="sm:col-span-2 lg:col-span-1">
								<WidgetErrorBoundary title="Provider health">
									<LazyProviderHealthSummary />
								</WidgetErrorBoundary>
							</div>
						</div>

						<div className="mb-6">
							<WidgetErrorBoundary title="Usage charts">
								<LazyUsageChart
									usageData={usageData}
									modelData={modelData}
									timeRange={timeRange}
								/>
							</WidgetErrorBoundary>
						</div>

						<QuickActions />

						<RecentTransactions transactions={transactions} />
					</div>
				)}

				{/* Usage Tab */}
				{activeTab === "usage" && (
					<m.div
						key="usage"
						id="panel-usage"
						role="tabpanel"
						aria-labelledby="tab-usage"
						aria-label="Usage"
						variants={tabContentVariants}
						initial="hidden"
						animate="visible"
						exit="exit"
					>
						{!loading && (!usage || usage.length === 0) ? (
							<EmptyState
								icon={Activity}
								title="No usage data"
								description="Start making API or chat requests — usage charts and request history will show up here."
								action={
									<a
										href="/chat"
										className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent/80"
									>
										Open chat playground →
									</a>
								}
							/>
						) : (
							<>
								<div className="mb-6">
									<WidgetErrorBoundary title="Usage charts">
										<LazyUsageChart
											usageData={usageData}
											modelData={modelData}
											timeRange={timeRange}
										/>
									</WidgetErrorBoundary>
								</div>

								<div className="mb-6">
									<WidgetErrorBoundary title="Model usage">
										<LazyModelUsageTable usage={usage} loading={loading} />
									</WidgetErrorBoundary>
								</div>

								<div className="mb-6">
									<WidgetErrorBoundary title="Provider breakdown">
										<LazyProviderBreakdown usage={usage} loading={loading} />
									</WidgetErrorBoundary>
								</div>

								<div className="border border-border bg-void">
									<WidgetErrorBoundary title="Recent requests">
										<LazyRecentRequestsTable
											usage={usage}
											loading={loading}
											page={page}
											limit={limit}
											onPageChange={onPageChange}
										/>
									</WidgetErrorBoundary>
								</div>
							</>
						)}
					</m.div>
				)}

				{/* API Keys Tab */}
				{activeTab === "api-keys" && (
					<m.div
						key="api-keys"
						id="panel-api-keys"
						role="tabpanel"
						aria-labelledby="tab-api-keys"
						aria-label="API Keys"
						className="border border-border bg-void"
						variants={tabContentVariants}
						initial="hidden"
						animate="visible"
						exit="exit"
					>
						{!loading &&
						(!apiKeys || apiKeys.length === 0) &&
						!showCreateForm ? (
							<EmptyState
								icon={KeyRound}
								title="No API keys"
								description="Create your first API key to start accessing the gateway programmatically."
								action={
									<button
										type="button"
										onClick={() => setShowCreateForm(true)}
										className="inline-flex items-center gap-2 bg-accent text-void px-4 py-2 text-sm font-medium rounded hover:bg-accent/90 transition-colors"
									>
										<KeyRound className="h-4 w-4" />
										Create API Key
									</button>
								}
							/>
						) : (
							<WidgetErrorBoundary title="API keys">
								<LazyApiKeyManager
									keys={apiKeys}
									loading={loading}
									creating={creating}
									showCreateForm={showCreateForm}
									newKeyName={newKeyName}
									copied={copied}
									revokingId={revokingId}
									onCopy={onCopy}
									onRevokeKey={onRevokeKey}
									onCreateKey={onCreateKey}
									setShowCreateForm={setShowCreateForm}
									setNewKeyName={setNewKeyName}
								/>
							</WidgetErrorBoundary>
						)}
					</m.div>
				)}

				{/* Health Tab — always show live readiness; does not require usage */}
				{activeTab === "health" && (
					<m.div
						key="health"
						id="panel-health"
						role="tabpanel"
						aria-labelledby="tab-health"
						aria-label="Health"
						className="border border-border bg-void"
						variants={tabContentVariants}
						initial="hidden"
						animate="visible"
						exit="exit"
					>
						<WidgetErrorBoundary title="Provider health">
							<LazyProviderHealthCard />
						</WidgetErrorBoundary>
					</m.div>
				)}
			</AnimatePresence>

			<Suspense fallback={null}>
				<LazyCreatedKeyModal
					createdKey={createdKey}
					copied={copied}
					onCopy={onCopy}
					onDismiss={onDismissCreatedKey}
				/>
			</Suspense>
		</>
	);
}
