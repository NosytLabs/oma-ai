"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";

const TrendChart = dynamic(() => import("./AdminTrendChart"), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-surface-elevated" /> });
export interface UsageBucket {
	at: string; requests: number; errors: number; aborted: number; freeRequests: number; failedOver: number;
	tokens: number; billedCents: number; knownUpstreamCents: number; unknownCostRequests: number; p95LatencyMs: number | null;
}
interface Timeline { items: UsageBucket[]; bucket: "hour" | "day" }
const ranges = [{ days: 1, label: "24 hours" }, { days: 7, label: "7 days" }, { days: 30, label: "30 days" }];

export function AdminAnalytics() {
	const { isReady, isAdmin } = useAuth();
	const [days, setDays] = useState(7);
	const timeline = useQuery({ queryKey: ["admin", "usage-timeline", days], enabled: isReady && isAdmin, staleTime: 30_000, refetchInterval: 60_000,
		queryFn: async (): Promise<Timeline> => {
			const response = await fetch(`/api/v1/admin/usage/timeline?days=${days}`, { credentials: "include", cache: "no-store" });
			if (!response.ok) throw new Error("Could not load usage trends.");
			return response.json();
		} });
	const items = timeline.data?.items ?? [];
	const totals = items.reduce((sum, row) => ({ requests: sum.requests + row.requests, errors: sum.errors + row.errors,
		failedOver: sum.failedOver + row.failedOver, free: sum.free + row.freeRequests, billed: sum.billed + row.billedCents,
		unknown: sum.unknown + row.unknownCostRequests }), { requests: 0, errors: 0, failedOver: 0, free: 0, billed: 0, unknown: 0 });
	return <section id="overview" className="scroll-mt-24 space-y-4" aria-label="Business overview" aria-busy={timeline.isFetching}>
		<header className="flex flex-wrap items-center justify-between gap-3">
			<div><h2 className="text-lg font-semibold text-text-bright">Usage at a glance</h2><p className="mt-1 text-sm text-text-muted">Stored usage records across all accounts. Charts use UTC.</p></div>
			<div className="flex flex-wrap gap-1" aria-label="Chart time range">{ranges.map(range => <button key={range.days} type="button" onClick={() => setDays(range.days)} aria-pressed={days === range.days}
				className={`min-h-11 rounded-md border px-3 text-sm transition-colors ${days === range.days ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-text-secondary hover:bg-surface-elevated"}`}>{range.label}</button>)}</div>
		</header>
		{timeline.isError ? <div role="alert" className="rounded-lg border border-error/30 bg-error/5 p-4 text-sm text-error">Usage trends could not load. <button type="button" className="min-h-11 underline" onClick={() => void timeline.refetch()}>Retry</button></div>
			: timeline.isPending ? <div role="status" className="h-32 animate-pulse rounded-lg border border-border bg-surface">Loading usage trends…</div> : <>
				<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
					{ label: "Customer charges", value: `$${(totals.billed / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`, hint: "Recorded usage, excluding refunds" },
					{ label: "Recorded requests", value: totals.requests.toLocaleString(), hint: `${totals.free.toLocaleString()} free website requests` },
					{ label: "Request errors", value: `${totals.requests ? (totals.errors / totals.requests * 100).toFixed(1) : "0.0"}%`, hint: `${totals.errors.toLocaleString()} errors; canceled streams excluded` },
					{ label: "Model fallbacks", value: totals.failedOver.toLocaleString(), hint: "Served by a different model than requested" },
				].map(stat => <div key={stat.label} className="min-w-0 rounded-xl border border-border bg-surface p-4"><p className="text-sm text-text-secondary">{stat.label}</p><p className="my-2 break-words text-2xl font-semibold tabular-nums text-text-bright">{stat.value}</p><p className="text-xs leading-relaxed text-text-muted">{stat.hint}</p></div>)}</div>
				{totals.requests === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-text-muted">No usage in this range yet. Charts will populate as requests are recorded.</p>}
				<div className="grid min-w-0 gap-4 lg:grid-cols-2">{(["traffic", "revenue"] as const).map(kind => <div key={kind} className="min-w-0 rounded-xl border border-border bg-surface p-4">
					<h3 className="mb-1 font-semibold text-text-bright">{kind === "traffic" ? "Requests & errors" : "Charges & known costs"}</h3>
					<p className="mb-3 text-xs text-text-muted">{kind === "traffic" ? "Green: requests · red: recorded errors" : "Green: customer charges · secondary: known cost estimate"}</p>
					<TrendChart items={items} kind={kind} hourly={timeline.data?.bucket === "hour"} />
				</div>)}</div>
				<p className="text-xs leading-relaxed text-text-muted">{totals.unknown > 0 ? `${totals.unknown.toLocaleString()} OpenBroker requests have an unknown USD cost. ` : ""}Cost estimates exclude unknown GNK costs and are not settled invoices. Requests rejected before usage is recorded appear in HTTP counters and server logs.</p>
			</>}
	</section>;
}
