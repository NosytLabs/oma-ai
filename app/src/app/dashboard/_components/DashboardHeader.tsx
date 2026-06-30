"use client";

import {
	Activity,
	ChevronRight,
	Clock,
	Download,
	Keyboard,
	RefreshCw,
	Settings,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHealthQuery } from "@/app/dashboard/_hooks/useHealthQuery";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { formatTime } from "@/lib/utils";

interface DashboardHeaderProps {
	loading: boolean;
	modelsAvailable: number;
	/** When true, force the "Awaiting data" line even if we've previously seen data. */
	hasAnyData: boolean;
	/** Increments every time the user explicitly hits RETRY/CLEAR — used to
	 *  bump the "Last updated" timestamp without depending on the data shape. */
	refreshTick?: number;
	/** Manual refresh callback. */
	onRefresh?: () => void;
	/** Export callback. */
	onExport?: () => void;
	/** Active tab for tab navigation. */
	activeTab?: string;
	/** Tab change callback. */
	onTabChange?: (tab: string) => void;
	/** Selected time range for analytics. */
	timeRange?: string;
	/** Time range change callback. */
	onTimeRangeChange?: (range: string) => void;
}

const TABS = [
	{ id: "overview", label: "Overview", icon: Zap },
	{ id: "usage", label: "Usage", icon: Clock },
	{ id: "api-keys", label: "API Keys", icon: null },
	{ id: "health", label: "Health", icon: null },
];

/** Auto-poll interval (ms). Picked to be low enough that "live" feels live
 *  but high enough that an idle tab doesn't hammer the API. */
const POLL_INTERVAL_MS = 120_000;

/**
 * Dashboard page heading + status line + refresh button + tab navigation.
 * Auto-polls every 120 seconds. Shows live status with relative time.
 */
const TIME_RANGES = [
	{ id: "24h", label: "24h" },
	{ id: "7d", label: "7d" },
	{ id: "30d", label: "30d" },
	{ id: "all", label: "All" },
];

export function DashboardHeader({
	loading,
	modelsAvailable,
	hasAnyData,
	refreshTick,
	onRefresh,
	onExport,
	activeTab = "overview",
	onTabChange,
	timeRange = "7d",
	onTimeRangeChange,
}: DashboardHeaderProps) {
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(120);

	// Single source of truth for "is a refresh in flight" — used by both the
	// 120s timer and the manual button. The previous implementation had two
	// parallel `setInterval`s and a separate `isRefreshing` state, which could
	// race: clicking Refresh at second 119 could fire the auto-poll within
	// milliseconds, both invalidating the same query keys.
	const refreshInFlightRef = useRef(false);

	// Reset the countdown to 120 and stamp the time atomically.
	const markRefreshed = useCallback(() => {
		setLastUpdated(new Date());
		setAutoRefreshCountdown(120);
	}, []);

	useEffect(() => {
		if (hasAnyData) markRefreshed();
	}, [hasAnyData, markRefreshed]);

	useEffect(() => {
		if (refreshTick && refreshTick > 0) markRefreshed();
	}, [refreshTick, markRefreshed]);

	// Drive the countdown from a single 1-second interval that reads the next-
	// refresh timestamp out of a ref. This removes the "0s lingers for a full
	// second" bug from the old `(prev) => prev - 1` math and keeps the timer
	// and the refresh in lockstep.
	useEffect(() => {
		if (!onRefresh || !hasAnyData) return;

		let nextRefreshAt = Date.now() + POLL_INTERVAL_MS;
		refreshInFlightRef.current = false;
		setAutoRefreshCountdown(120);

		const tick = setInterval(() => {
			const remaining = Math.max(
				0,
				Math.round((nextRefreshAt - Date.now()) / 1000),
			);
			setAutoRefreshCountdown(remaining);
			if (remaining === 0 && !refreshInFlightRef.current) {
				refreshInFlightRef.current = true;
				Promise.resolve(onRefresh())
					.catch(() => {})
					.finally(() => {
						nextRefreshAt = Date.now() + POLL_INTERVAL_MS;
						refreshInFlightRef.current = false;
						setLastUpdated(new Date());
						setAutoRefreshCountdown(120);
					});
			}
		}, 1000);

		return () => clearInterval(tick);
	}, [onRefresh, hasAnyData]);

	const handleRefresh = useCallback(async () => {
		if (!onRefresh || refreshInFlightRef.current) return;
		refreshInFlightRef.current = true;
		setIsRefreshing(true);
		markRefreshed();
		try {
			await onRefresh();
		} finally {
			setIsRefreshing(false);
			refreshInFlightRef.current = false;
		}
	}, [onRefresh, markRefreshed]);

	return (
		<div className="mb-8">
			{/* Breadcrumb */}
			<nav
				className="flex items-center gap-2 text-[11px] text-text-muted mb-4"
				aria-label="Breadcrumb"
			>
				<Link href="/" className="hover:text-text-secondary transition-colors">
					Home
				</Link>
				<ChevronRight className="h-3 w-3" aria-hidden="true" />
				<span className="text-text-secondary" aria-current="page">
					Dashboard
				</span>
			</nav>

			{/* Title + Status Row */}
			<div className="flex items-start justify-between gap-4 mb-4">
				<div>
					<h1 className="h1-utility text-text-bright flex items-center gap-3">
						<Zap className="h-5 w-5 text-accent" aria-hidden="true" />
						Dashboard
					</h1>
					<div className="mt-2 flex items-center gap-4 text-[11px] text-text-muted">
						<span className="flex items-center gap-1.5">
							<span
								aria-hidden="true"
								className={`inline-block h-1.5 w-1.5 rounded-full ${loading ? "bg-warning animate-pulse" : "bg-success"}`}
							/>
							{loading
								? "Syncing..."
								: lastUpdated
									? `Updated ${formatTime(lastUpdated.toISOString())}`
									: "Awaiting data"}
						</span>
						<SystemStatus />
						<span
							className="hidden items-center gap-1 text-text-muted/50 sm:flex"
							title="Keyboard shortcuts: R = refresh, 1-4 = switch tabs"
						>
							<Keyboard className="h-3 w-3" aria-hidden="true" />
							<span className="font-mono text-[10px]">R · 1-4</span>
						</span>
						{modelsAvailable > 0 && (
							<span className="flex items-center gap-1.5 text-text-muted/70">
								<span
									aria-hidden="true"
									className="inline-block h-1 w-1 bg-text-muted/50"
								/>
								{modelsAvailable} model{modelsAvailable !== 1 ? "s" : ""} online
							</span>
						)}
						{hasAnyData && autoRefreshCountdown > 0 && (
							<span className="flex items-center gap-1.5 text-text-muted/50">
								<Clock className="h-3 w-3" aria-hidden="true" />
								Next refresh in {autoRefreshCountdown}s
							</span>
						)}
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex items-center gap-2">
					<NotificationBell className="mr-1" />
					{onTimeRangeChange &&
						(activeTab === "overview" || activeTab === "usage") && (
							<div
								className="flex border border-border bg-surface"
								role="radiogroup"
								aria-label="Time range"
							>
								{TIME_RANGES.map((range) => (
									<button
										type="button"
										key={range.id}
										role="radio"
										aria-checked={timeRange === range.id}
										onClick={() => onTimeRangeChange(range.id)}
										className={`px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-medium transition-all ${
											timeRange === range.id
												? "bg-accent/10 text-accent"
												: "text-text-muted hover:text-text-secondary"
										}`}
									>
										{range.label}
									</button>
								))}
							</div>
						)}
					<Link
						href="/settings"
						className="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-widest text-text-muted border border-border bg-surface hover:border-accent/40 hover:text-accent transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						aria-label="Settings"
					>
						<Settings className="h-3.5 w-3.5" aria-hidden="true" />
					</Link>
					<button
						type="button"
						onClick={handleRefresh}
						disabled={isRefreshing}
						aria-label="Refresh dashboard"
						className="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-widest text-text-muted border border-border bg-surface hover:border-accent/40 hover:text-accent transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						<RefreshCw
							className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
							aria-hidden="true"
						/>
						{isRefreshing ? "Syncing" : "Refresh"}
					</button>
					{onExport && (activeTab === "usage" || activeTab === "overview") && (
						<button
							type="button"
							onClick={onExport}
							aria-label="Export usage data"
							className="flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-widest text-text-muted border border-border bg-surface hover:border-accent/40 hover:text-accent transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<Download className="h-3.5 w-3.5" aria-hidden="true" />
							Export
						</button>
					)}
				</div>
			</div>

			{/* Tab Navigation */}
			{onTabChange && (
				<nav
					className="flex gap-px border-b border-border"
					aria-label="Dashboard sections"
				>
					{TABS.map((tab) => (
						<button
							type="button"
							key={tab.id}
							id={`tab-${tab.id}`}
							role="tab"
							aria-selected={activeTab === tab.id}
							aria-controls={`panel-${tab.id}`}
							onClick={() => onTabChange(tab.id)}
							className={`px-4 py-3 text-[11px] uppercase tracking-widest font-medium transition-all border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${
								activeTab === tab.id
									? "border-accent text-accent bg-accent/5"
									: "border-transparent text-text-muted hover:text-text-secondary hover:border-border-bright"
							}`}
						>
							<span className="flex items-center gap-1.5">
								{tab.icon && (
									<tab.icon className="h-3 w-3" aria-hidden="true" />
								)}
								{tab.label}
							</span>
						</button>
					))}
				</nav>
			)}
		</div>
	);
}

/**
 * Compact "all providers up?" pill in the dashboard status row. Pulls from
 * the same /health endpoint the ProviderHealthSummary uses, with its own
 * 30s refetch so it never goes stale while the user is on the overview.
 * Renders nothing while loading to avoid a layout shift.
 */
function SystemStatus() {
	const { data } = useHealthQuery();
	if (!data) return null;

	const checks = Object.values(data.checks ?? {}) as Array<{ status?: string }>;
	const hasOutage = checks.some(
		(c) => c.status === "circuit_open" || c.status === "outage",
	);
	const hasDegraded = checks.some(
		(c) => c.status === "degraded" || c.status === "rate_limited",
	);
	const label = hasOutage
		? "Outage"
		: hasDegraded
			? "Degraded"
			: "All systems normal";
	const dotClass = hasOutage
		? "bg-pink"
		: hasDegraded
			? "bg-warning"
			: "bg-success";
	const textClass = hasOutage
		? "text-pink"
		: hasDegraded
			? "text-warning"
			: "text-success";

	return (
		<span className="flex items-center gap-1.5">
			<span
				aria-hidden="true"
				className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`}
			/>
			<Activity className={`h-3 w-3 ${textClass}`} aria-hidden="true" />
			<Link
				href="/dashboard?tab=health"
				className={`hover:underline ${textClass}`}
			>
				{label}
			</Link>
		</span>
	);
}
