"use client";

import Link from "next/link";
import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import {
	Activity,
	CreditCard,
	Coins,
	Inbox,
	KeyRound,
	type LucideIcon,
} from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { CreditBalanceCard } from "@/components/dashboard/CreditBalanceCard";
import { ErrorBoundary } from "@/components/error-boundary";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { buildTopModels, buildUsageByDay } from "@/lib/dashboard-aggregate";
import type {
	ApiKey,
	ApiKeyWithSecret,
	BalanceResponse,
	CreditBatch,
	CreditTransaction,
	UsageRecord,
} from "@/lib/api";
import type { TabId, TimeRangeId } from "../_constants";
import { QuickActions } from "./QuickActions";
import { QuickStatsCard } from "./QuickStatsCard";
import { RecentTransactions } from "./RecentTransactions";
import { AutoReloadCard } from "./AutoReloadCard";
import { DashboardErrorBanner } from "./DashboardErrorBanner";
import {
	LazyApiKeyManager,
	LazyCreatedKeyModal,
	LazyExpiringCreditsWarning,
	LazyModelUsageTable,
	LazyProviderBreakdown,
	LazyProviderHealthCard,
	LazyProviderHealthSummary,
	LazyRecentRequestsTable,
	LazyUsageChart,
} from "./lazy-widgets";

const tabContentVariants = {
	hidden: { opacity: 0, y: 8 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] as const },
	},
	exit: {
		opacity: 0,
		y: -6,
		transition: { duration: 0.14, ease: [0.23, 1, 0.32, 1] as const },
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
			transition={{ delay: 0.05, ...springs.soft }}
			className="flex flex-col items-center justify-center py-16 px-6 text-center"
		>
			<div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-xl)] border border-border bg-surface text-text-muted mb-4">
				<Icon className="h-5 w-5" aria-hidden="true" />
			</div>
			<h2 className="text-text-bright text-lg font-medium mb-2">{title}</h2>
			<p className="text-text-secondary text-sm max-w-md mb-6">{description}</p>
			{action}
		</m.div>
	);
}

/** Wraps a lazy component in a mini error boundary so one failing widget
	* doesn't crater the whole dashboard. */
export function WidgetErrorBoundary({
	children,
	title,
}: {
	children: React.ReactNode;
	title?: string;
}) {
	const [showDetails, setShowDetails] = useState(false);

	return (
		<ErrorBoundary
			fallback={
				<div className="rounded-[var(--radius-lg)] border border-error/20 bg-error/5 p-4 text-center">
					<p className="text-xs text-error font-medium">
						{title ?? "Widget"} failed to load
					</p>
					<button 
						type="button" 
						onClick={() => setShowDetails(!showDetails)}
						className="text-[10px] text-text-muted mt-1 hover:text-text-secondary underline underline-offset-2"
					>
						{showDetails ? "Hide details" : "Show details"}
					</button>
					{showDetails && (
						<div className="mt-3 text-left bg-void border border-border p-2 rounded text-[10px] text-text-muted overflow-auto max-h-32">
							<p>Check the console for full stack trace.</p>
							<p className="mt-1">Usually indicates a network or API response issue.</p>
						</div>
					)}
					<p className="text-[10px] text-text-muted mt-3">
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

	// Whether the current session is signed in with a wallet (SIWE).
	// Drives the OnboardingChecklist "wallet connected" milestone.
	walletConnected?: boolean;
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
		walletConnected = false,
	} = props;

	// `usage` is already time-range filtered by the page (`filteredUsage`).
	// Derive the chart datasets via the shared aggregate helpers.
	const usageData = useMemo(() => buildUsageByDay(usage ?? []), [usage]);
	const modelData = useMemo(() => buildTopModels(usage ?? []), [usage]);

	return (
		<>
			<DashboardErrorBanner
				error={error}
				backendUnavailable={backendUnavailable}
				onRefresh={onRefresh}
			/>

			<AnimatePresence mode="wait">
				{/* Overview Tab */}
				{activeTab === "overview" && (
					<m.div
						key="overview"
						id="panel-overview"
						role="tabpanel"
						aria-labelledby="tab-overview"
						aria-label="Overview"
						variants={tabContentVariants}
						initial="hidden"
						animate="visible"
						exit="exit"
					>
						{/* Onboarding checklist for new users */}
						{!loading && (
							<OnboardingChecklist
								walletConnected={walletConnected}
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

						<div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-h-[12rem] p-6">
							<WidgetErrorBoundary title="Credits">
								<CreditBalanceCard
									balance={balance}
									loading={loading}
									recentUsage={usage}
								/>
							</WidgetErrorBoundary>
							<WidgetErrorBoundary title="Auto reload">
								<AutoReloadCard />
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
							<WidgetErrorBoundary title="Top up credits">
								<div className="flex flex-col h-full justify-between p-6 bg-surface/30 border border-border rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] relative overflow-hidden transition-colors duration-200 ease-out hover:border-accent/40">
									<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/40 via-accent/20 to-transparent" />
									<div className="flex items-start justify-between gap-4">
										<div>
											<p className="text-[14.5px] font-bold text-text-bright tracking-tight">Top up credits</p>
											<p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-text-muted">Choose card or USDC.</p>
										</div>
										<span className="rounded-[var(--radius-sm)] border border-accent/30 bg-accent/10 px-2.5 py-1 text-[9.5px] font-mono font-bold uppercase tracking-wider text-accent shadow-[0_0_10px_-2px_var(--color-accent-glow)] shrink-0">
											 + USDC
										</span>
									</div>
									<div className="mt-8 flex flex-col gap-3">
										<Link
											href="/deposit?method=card"
											className="group flex flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-void px-4 py-3 text-[11.5px] font-bold uppercase tracking-wider text-text-secondary transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:border-accent/50 hover:bg-accent/5 hover:text-text-bright hover:shadow-[0_0_15px_-5px_var(--color-accent-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] gap-2.5"
										>
											<CreditCard className="h-4 w-4" aria-hidden="true" />
											Card
										</Link>
										<Link
											href="/deposit?method=crypto"
											className="group flex flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface px-4 py-3 text-[11.5px] font-bold uppercase tracking-wider text-text-secondary transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:bg-surface-elevated hover:text-text-bright hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border active:scale-[0.97] gap-2.5"
										>
											<Coins className="h-4 w-4" aria-hidden="true" />
											USDC
										</Link>
									</div>
								</div>
							</WidgetErrorBoundary>
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
					</m.div>
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
									<Link
										href="/chat"
										className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors duration-200 ease-out hover:text-accent/80"
									>
										Open chat playground →
									</Link>
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

								<div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
									<WidgetErrorBoundary title="Model usage">
										<LazyModelUsageTable usage={usage} loading={loading} />
									</WidgetErrorBoundary>
									<WidgetErrorBoundary title="Provider breakdown">
										<LazyProviderBreakdown usage={usage} loading={loading} />
									</WidgetErrorBoundary>
								</div>

								<div className="bg-surface border border-border/60 rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] relative overflow-hidden h-full">
									<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-success/40 to-transparent" />
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
										className="inline-flex items-center gap-2 bg-accent text-void px-4 py-2 text-sm font-medium rounded-[var(--radius-sm)] hover:bg-accent/90 transition-colors duration-200 ease-out"
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