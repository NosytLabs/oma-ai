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
import { m } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useHealthQuery } from "@/app/dashboard/_hooks/useHealthQuery";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { log } from "@/lib/logger";
import { formatTime } from "@/lib/utils";
import { TABS, TIME_RANGES, type TabId, type TimeRangeId } from "../_constants";

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
	activeTab?: TabId;
	/** Tab change callback. */
	onTabChange?: (tab: TabId) => void;
	/** Selected time range for analytics. */
	timeRange?: TimeRangeId;
	/** Time range change callback. */
	onTimeRangeChange?: (range: TimeRangeId) => void;
	/** Whether authenticated notification data may be fetched. */
	notificationsEnabled?: boolean;
}

/** Auto-poll interval (ms). Picked to be low enough that "live" feels live
 *  but high enough that an idle tab doesn't hammer the API. */
const POLL_INTERVAL_MS = 120_000;

/**
 * Dashboard page heading + status line + refresh button + tab navigation.
 * Auto-polls every 120 seconds. Shows live status with relative time.
 */

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
	notificationsEnabled = true,
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

		const refreshIfVisible = () => {
			if (document.visibilityState !== "visible" || refreshInFlightRef.current) return;
			refreshInFlightRef.current = true;
			Promise.resolve(onRefresh())
				.catch((err) => {
					log.warn("Auto-refresh failed", err);
				})
				.finally(() => {
					nextRefreshAt = Date.now() + POLL_INTERVAL_MS;
					refreshInFlightRef.current = false;
					setLastUpdated(new Date());
					setAutoRefreshCountdown(120);
				});
		};

		const tick = setInterval(() => {
			if (document.visibilityState !== "visible") return;
			const remaining = Math.max(
				0,
				Math.round((nextRefreshAt - Date.now()) / 1000),
			);
			setAutoRefreshCountdown(remaining);
			if (remaining === 0) refreshIfVisible();
		}, 1000);
		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				nextRefreshAt = Date.now();
				refreshIfVisible();
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			clearInterval(tick);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
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
				className="flex items-center gap-2 text-[11px] text-text-muted mb-4 font-mono tracking-wide"
				aria-label="Breadcrumb"
			>
				<Link href="/" className="hover:text-text-secondary transition-colors">
					HOME
				</Link>
				<ChevronRight className="h-3 w-3 opacity-50" aria-hidden="true" />
				<span className="text-text-secondary" aria-current="page">
					DASHBOARD
				</span>
			</nav>

			{/* Title + Status Row */}
			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<h1 className="h1-utility text-text-bright flex items-center gap-3">
						<Zap className="h-5 w-5 shrink-0 text-accent drop-shadow-[0_0_8px_var(--color-accent)]" aria-hidden="true" />
						Dashboard
					</h1>
					<div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-text-muted font-mono tracking-wide">
						<span className="flex items-center gap-1.5 bg-surface/50 px-2 py-0.5 rounded border border-border/50">
							<span
								aria-hidden="true"
								className={`inline-block h-1.5 w-1.5 rounded-full ${loading ? "bg-warning animate-pulse" : "bg-success shadow-[0_0_5px_var(--color-success)]"}`}
							/>
							{loading
								? "SYNCING..."
								: lastUpdated
									? `UPDATED ${formatTime(lastUpdated.toISOString())}`
									: "AWAITING DATA"}
						</span>
						<SystemStatus />
						<span
							className="hidden items-center gap-1.5 text-text-secondary/80 md:flex bg-surface/50 px-2 py-0.5 rounded border border-border/50"
							title="Keyboard shortcuts: R = refresh, 1-4 = switch tabs"
						>
							<Keyboard className="h-3 w-3" aria-hidden="true" />
							<span>R · 1-4</span>
						</span>
						{modelsAvailable > 0 && (
							<span className="flex items-center gap-1.5 text-text-muted/70">
								<span
									aria-hidden="true"
									className="inline-block h-1 w-1 bg-text-muted/50"
								/>
								{modelsAvailable} MODEL{modelsAvailable !== 1 ? "S" : ""} ONLINE
							</span>
						)}
						{hasAnyData && autoRefreshCountdown > 0 && (
							<span className="hidden items-center gap-1.5 text-text-muted/50 sm:flex">
								<Clock className="h-3 w-3" aria-hidden="true" />
								NEXT IN {autoRefreshCountdown}s
							</span>
						)}
					</div>
				</div>

				{/* Action Buttons — wrap on narrow viewports; no horizontal page overflow */}
				<div className="flex max-w-full flex-wrap items-center gap-2">
					{notificationsEnabled && <NotificationBell />}
					{onTimeRangeChange &&
						(activeTab === "overview" || activeTab === "usage") && (
							<TimeRangeRadiogroup
								timeRange={timeRange}
								onTimeRangeChange={onTimeRangeChange}
							/>
						)}
					<Link
						href="/settings"
						className="flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 min-h-[36px] text-[11px] font-bold uppercase tracking-widest text-text-muted transition-all duration-200 hover:bg-surface-elevated hover:border-accent/40 hover:text-text-bright active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						aria-label="Settings"
					>
						<Settings className="h-3.5 w-3.5" aria-hidden="true" />
					</Link>
					<button
						type="button"
						onClick={handleRefresh}
						disabled={isRefreshing}
						aria-label="Refresh dashboard"
						className="flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 min-h-[36px] text-[11px] font-bold uppercase tracking-widest text-text-muted transition-all duration-200 hover:bg-surface-elevated hover:border-accent/40 hover:text-text-bright active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						<RefreshCw
							className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-accent" : ""}`}
							aria-hidden="true"
						/>
						<span className="hidden sm:inline">
							{isRefreshing ? "SYNCING" : "REFRESH"}
						</span>
					</button>
					{onExport && (activeTab === "usage" || activeTab === "overview") && (
						<button
							type="button"
							onClick={onExport}
							aria-label="Export usage data"
							className="flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 min-h-[36px] text-[11px] font-bold uppercase tracking-widest text-text-muted transition-all duration-200 hover:bg-surface-elevated hover:border-accent/40 hover:text-text-bright active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<Download className="h-3.5 w-3.5" aria-hidden="true" />
							<span className="hidden sm:inline">EXPORT</span>
						</button>
					)}
				</div>
			</div>

			{/* Tab Navigation — scrollable on mobile, no page overflow */}
			{onTabChange && (
				<div
					role="tablist"
					className="-mx-1 flex gap-2 overflow-x-auto border-b border-border/50 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
							className={`relative shrink-0 px-4 py-3 text-[11.5px] font-bold uppercase tracking-widest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset sm:px-6 ${
								activeTab === tab.id
									? "text-text-bright"
									: "text-text-muted hover:text-text-secondary hover:bg-surface/30 rounded-t-[var(--radius-sm)]"
							}`}
						>
							<span className="flex items-center gap-2">
								{tab.icon && (
									<tab.icon className={`h-3.5 w-3.5 ${activeTab === tab.id ? "text-accent" : "opacity-70"}`} aria-hidden="true" />
								)}
								{tab.label}
							</span>
							{activeTab === tab.id && (
								<m.div
									layoutId="activeDashboardTab"
									className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent shadow-[0_-2px_10px_rgba(var(--color-accent-rgb),0.5)]"
									transition={{ type: "spring", stiffness: 400, damping: 30 }}
								/>
							)}
						</button>
					))}
				</div>
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
	const hasOutage =
		data.status === "outage" ||
		checks.some((c) => c.status === "circuit_open" || c.status === "outage");
	const hasDegraded =
		data.status === "degraded" ||
		checks.some(
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

/**
 * Time-range radio group with roving-tabindex keyboard navigation.
 *
 * Implements the WAI-ARIA radiogroup pattern: only the selected radio is
 * tabbable (tabIndex=0), the rest are tabIndex=-1. Arrow Left/Right (or
 * Up/Down) move both focus and selection; Home/End jump to the first/last
 * option. Space/Enter activates the focused option. Wrapping at the ends
 * keeps the keyboard experience continuous.
 */
function TimeRangeRadiogroup({
	timeRange,
	onTimeRangeChange,
}: {
	timeRange: TimeRangeId;
	onTimeRangeChange: (range: TimeRangeId) => void;
}) {
	const rangeIds = TIME_RANGES.map((r) => r.id);
	const selectedIndex = Math.max(
		0,
		rangeIds.indexOf(timeRange as (typeof rangeIds)[number]),
	);
	const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

	const focusByIndex = useCallback((index: number) => {
		const safe = (index % rangeIds.length + rangeIds.length) % rangeIds.length;
		buttonRefs.current[safe]?.focus();
	}, [rangeIds.length]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLDivElement>) => {
			let next = selectedIndex;
			switch (e.key) {
				case "ArrowRight":
				case "ArrowDown":
					next = selectedIndex + 1;
					break;
				case "ArrowLeft":
				case "ArrowUp":
					next = selectedIndex - 1;
					break;
				case "Home":
					next = 0;
					break;
				case "End":
					next = rangeIds.length - 1;
					break;
				case " ":
				case "Enter":
					e.preventDefault();
					onTimeRangeChange(timeRange);
					return;
				default:
					return;
			}
			e.preventDefault();
			const safe = (next % rangeIds.length + rangeIds.length) % rangeIds.length;
			onTimeRangeChange(rangeIds[safe] as TimeRangeId);
			focusByIndex(safe);
		},
		[focusByIndex, onTimeRangeChange, rangeIds, selectedIndex, timeRange],
	);

	return (
		<div
			className="flex shrink-0 border border-border bg-surface"
			role="radiogroup"
			aria-label="Time range"
			onKeyDown={handleKeyDown}
		>
			{TIME_RANGES.map((range, i) => {
				const checked = timeRange === range.id;
				return (
					<button
						type="button"
						key={range.id}
						ref={(el) => {
							buttonRefs.current[i] = el;
						}}
						role="radio"
						aria-checked={checked}
						tabIndex={checked ? 0 : -1}
						onClick={() => onTimeRangeChange(range.id)}
						className={`px-2 py-1.5 text-[10px] uppercase tracking-wider font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-2.5 ${
							checked
								? "bg-accent/10 text-accent"
								: "text-text-muted hover:text-text-secondary"
						}`}
					>
						{range.label}
					</button>
				);
			})}
		</div>
	);
}
