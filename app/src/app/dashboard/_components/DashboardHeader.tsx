"use client";

import {
	ChevronRight,
	Clock,
	Download,
	Keyboard,
	RefreshCw,
	Zap,
} from "lucide-react";
import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
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
	 * bump the "Last updated" timestamp without depending on the data shape. */
	refreshTick?: number;
	/** Manual refresh callback. */
	onRefresh?: () => void;
	/** Export callback. */
	onExport?: () => void;
	exporting?: boolean;
	exportDisabled?: boolean;
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
	/** Failed requests must not be presented as a successful sync. */
	hasError?: boolean;
}

/** Auto-poll interval (ms). Picked to be low enough that "live" feels live
	* but high enough that an idle tab doesn't hammer the API. */
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
	exporting = false,
	exportDisabled = false,
	activeTab = "overview",
	onTabChange,
	timeRange = "7d",
	onTimeRangeChange,
	notificationsEnabled = true,
	hasError = false,
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
		if (hasAnyData && !loading && !hasError) markRefreshed();
	}, [hasAnyData, loading, hasError, markRefreshed]);

	useEffect(() => {
		if (refreshTick && refreshTick > 0 && !hasError) markRefreshed();
	}, [refreshTick, hasError, markRefreshed]);

	// Drive the countdown from a single 1-second interval that reads the next-
	// refresh timestamp out of a ref. This removes the "0s lingers for a full
	// second" bug from the old `(prev) => prev - 1` math and keeps the timer
	// and the refresh in lockstep.
	useEffect(() => {
		if (!onRefresh || !hasAnyData || activeTab === "settings") return;

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
	}, [onRefresh, hasAnyData, activeTab]);

	const handleRefresh = useCallback(async () => {
		if (!onRefresh || refreshInFlightRef.current) return;
		refreshInFlightRef.current = true;
		setIsRefreshing(true);
		try {
			await onRefresh();
		} finally {
			setIsRefreshing(false);
			refreshInFlightRef.current = false;
		}
	}, [onRefresh]);

	const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

	const visibleTabs = TABS;
	const selectedTabIndex = Math.max(
		0,
		visibleTabs.findIndex((tab) => tab.id === activeTab),
	);

	const handleTabKeyDown = useCallback(
		(e: KeyboardEvent<HTMLDivElement>) => {
			if (!onTabChange) return;
			let next = selectedTabIndex;
			switch (e.key) {
				case "ArrowRight":
				case "ArrowDown":
					next = selectedTabIndex + 1;
					break;
				case "ArrowLeft":
				case "ArrowUp":
					next = selectedTabIndex - 1;
					break;
				case "Home":
					next = 0;
					break;
				case "End":
					next = visibleTabs.length - 1;
					break;
				default:
					return;
			}
			e.preventDefault();
			const safe = (next % visibleTabs.length + visibleTabs.length) % visibleTabs.length;
			onTabChange(visibleTabs[safe].id);
			tabRefs.current[safe]?.focus();
		},
		[onTabChange, selectedTabIndex, visibleTabs],
	);

	return (
		<div className="mb-8">
			{/* Breadcrumb */}
			<nav
				className="flex items-center gap-2 text-[11px] text-text-muted mb-4 font-mono tracking-wide"
				aria-label="Breadcrumb"
			>
				<Link href="/" className="hover:text-text-secondary transition-colors duration-200 ease-out">
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
					<p className="mt-2 text-sm text-text-secondary">Credits, usage, API keys and account settings.</p>
					<div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-text-muted font-mono tracking-wide">
						{activeTab !== "settings" && <span className="flex items-center gap-1.5 bg-surface/50 px-2 py-0.5 rounded-[var(--radius-sm)] border border-border/50">
							<span
								aria-hidden="true"
								className={`inline-block h-1.5 w-1.5 rounded-full ${hasError ? "bg-error" : loading ? "bg-warning animate-pulse" : lastUpdated ? "bg-success" : "bg-text-muted"}`}
							/>
							{hasError ? "SYNC FAILED" : loading
								? "SYNCING..."
								: lastUpdated
									? `UPDATED ${formatTime(lastUpdated.toISOString())}`
									: "AWAITING DATA"}
						</span>}
						<span
							className="hidden items-center gap-1.5 text-text-secondary/80 md:flex bg-surface/50 px-2 py-0.5 rounded-[var(--radius-sm)] border border-border/50"
							title={`Keyboard shortcuts: ${activeTab === "settings" ? "" : "R = refresh, "}1-${TABS.length} = switch tabs`}
						>
							<Keyboard className="h-3 w-3" aria-hidden="true" />
							<span>{activeTab === "settings" ? "" : "R · "}1-{TABS.length}</span>
						</span>
						{modelsAvailable > 0 && (
							<span className="flex items-center gap-1.5 whitespace-nowrap text-text-muted/70">
								<span
									aria-hidden="true"
									className="inline-block h-1 w-1 bg-text-muted/50"
								/>
								{modelsAvailable} {modelsAvailable === 1 ? "model" : "models"} available
							</span>
						)}
						{activeTab !== "settings" && hasAnyData && autoRefreshCountdown > 0 && (
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
					{activeTab !== "settings" && <button
						type="button"
						onClick={handleRefresh}
						disabled={isRefreshing || loading}
						aria-label="Refresh dashboard"
						className="flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 min-h-11 text-[11px] font-bold uppercase tracking-widest text-text-muted transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:bg-surface-elevated hover:border-accent/40 hover:text-text-bright active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						<RefreshCw
							className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-accent" : ""}`}
							aria-hidden="true"
						/>
						<span className="hidden sm:inline">
							{isRefreshing ? "SYNCING" : "REFRESH"}
						</span>
					</button>}
					{onExport && (activeTab === "usage" || activeTab === "overview") && (
						<button
							type="button"
							onClick={onExport}
							disabled={exporting || exportDisabled}
							aria-label={exporting ? "Exporting usage data" : `Export usage data for ${timeRange === "all" ? "all time" : timeRange}`}
							aria-busy={exporting}
							title={exportDisabled ? "Available after account usage loads. Demo exports are disabled." : "Download up to 10,000 requests in the selected date range"}
							className="flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 min-h-11 text-[11px] font-bold uppercase tracking-widest text-text-muted transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:bg-surface-elevated hover:border-accent/40 hover:text-text-bright active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<Download className="h-3.5 w-3.5" aria-hidden="true" />
							<span className="hidden sm:inline">{exporting ? "EXPORTING…" : `EXPORT ${timeRange === "all" ? "ALL" : timeRange.toUpperCase()}`}</span>
						</button>
					)}
				</div>
			</div>

			{/* Keep every section visible on small screens. */}
			{onTabChange && (
				<div
					role="tablist"
					className="flex border-b border-border/50 sm:gap-2"
					aria-label="Dashboard sections"
					onKeyDown={handleTabKeyDown}
				>
					{visibleTabs.map((tab, i) => (
						<button
							type="button"
							key={tab.id}
							id={`tab-${tab.id}`}
							ref={(el) => {
								tabRefs.current[i] = el;
							}}
							role="tab"
							aria-selected={activeTab === tab.id}
							aria-controls={`panel-${tab.id}`}
							tabIndex={activeTab === tab.id ? 0 : -1}
							onClick={() => onTabChange(tab.id)}
							className={`relative min-w-0 flex-1 px-1 py-3 text-[10px] font-bold uppercase tracking-wide transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset sm:flex-none sm:px-6 sm:text-[11.5px] sm:tracking-widest ${
								activeTab === tab.id
									? "text-text-bright"
									: "text-text-muted hover:text-text-secondary hover:bg-surface/30 rounded-t-[var(--radius-sm)]"
							}`}
						>
							<span className="flex items-center justify-center sm:gap-2">
								{tab.icon && (
									<tab.icon className={`hidden h-3.5 w-3.5 sm:block ${activeTab === tab.id ? "text-accent" : "opacity-70"}`} aria-hidden="true" />
								)}
								{tab.label}
							</span>
							{activeTab === tab.id && (
								<m.div
									layoutId="activeDashboardTab"
									className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent shadow-[0_-2px_10px_var(--color-accent-glow)]"
									transition={springs.tab}
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
						className={`min-h-11 px-2.5 text-[10px] uppercase tracking-wider font-medium transition-[background-color,border-color,box-shadow,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:px-3 ${
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
