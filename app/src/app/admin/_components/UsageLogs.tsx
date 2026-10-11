"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";

interface UsageLog {
	id: string; requestId: string; createdAt: string; model: string; requestedModel: string | null; provider: string; routedVia: string | null;
	attemptCount: number; status: string; inputTokens: number; outputTokens: number; latencyMs: number | null; refundedAt: string | null;
	userId: string; userEmail: string | null; userName: string | null; upstreamCents: number | null; billedCents: number;
}
const statuses: Record<string, string> = { completed: "Completed", free_tier: "Free website chat", aborted: "Canceled stream", error: "Error" };
const dollars = (cents: number) => `$${(cents / 100).toFixed(cents >= 1 ? 2 : 6)}`;

export function UsageLogs() {
	const { isReady, isAdmin } = useAuth();
	const [search, setSearch] = useState("");
	const [query, setQuery] = useState("");
	const [status, setStatus] = useState("");
	const [days, setDays] = useState("7");
	const [cursor, setCursor] = useState<string | null>(null);
	const [previous, setPrevious] = useState<Array<string | null>>([]);
	const resetPage = () => { setCursor(null); setPrevious([]); };
	useEffect(() => { const timeout = window.setTimeout(() => { setQuery(search.trim()); setCursor(null); setPrevious([]); }, 300); return () => window.clearTimeout(timeout); }, [search]);
	const logs = useQuery({ queryKey: ["admin", "usage-logs", query, status, days, cursor], enabled: isReady && isAdmin, staleTime: 15_000,
		queryFn: async (): Promise<{ items: UsageLog[]; nextCursor: string | null }> => {
			const params = new URLSearchParams({ days, limit: "25" });
			if (query) params.set("q", query); if (status) params.set("status", status); if (cursor) params.set("cursor", cursor);
			const response = await fetch(`/api/v1/admin/usage/logs?${params}`, { credentials: "include", cache: "no-store" });
			if (!response.ok) throw new Error("Usage logs could not load.");
			return response.json();
		} });
	return <section id="usage-logs" className="min-w-0 scroll-mt-24 rounded-xl border border-border bg-surface p-4 sm:p-5" aria-label="Usage logs" aria-busy={logs.isFetching}>
		<header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-text-bright">Usage logs</h2><p className="mt-1 text-sm text-text-muted">Trace a request, its actual model, tokens, charge, and fallback attempts. Prompt content is not stored.</p></div>
			<button type="button" onClick={() => { resetPage(); void logs.refetch(); }} disabled={logs.isFetching} className="min-h-11 rounded-md border border-border px-3 text-sm text-text-secondary disabled:opacity-50">Refresh logs</button></header>
		<div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
			<label className="block text-xs text-text-muted">Search user or request ID<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Email, name, user ID, or request ID" className="mt-1 min-h-11 w-full rounded-md border border-border bg-void px-3 text-sm text-text-bright" /></label>
			<label className="block text-xs text-text-muted">Outcome<select value={status} onChange={event => { setStatus(event.target.value); resetPage(); }} className="mt-1 min-h-11 w-full rounded-md border border-border bg-void px-3 text-sm text-text-bright"><option value="">All outcomes</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
			<label className="block text-xs text-text-muted">Log range<select value={days} onChange={event => { setDays(event.target.value); resetPage(); }} className="mt-1 min-h-11 w-full rounded-md border border-border bg-void px-3 text-sm text-text-bright">{[1, 7, 30, 90].map(value => <option key={value} value={value}>{value === 1 ? "24 hours" : `${value} days`}</option>)}</select></label>
		</div>
		{logs.isError ? <p role="alert" className="text-sm text-error">Usage logs could not load. Try Refresh logs.</p> : logs.isPending ? <p role="status" className="py-6 text-sm text-text-muted">Loading usage logs…</p> : logs.data.items.length === 0 ? <p className="rounded-md border border-dashed border-border p-6 text-sm text-text-muted">No matching usage records. Try another range or clear the search.</p> :
			<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Recorded usage. Expand a model to inspect the request and routing details.</caption><thead><tr className="border-b border-border text-xs text-text-muted">{["Time", "Account", "Model & request", "Outcome", "Tokens", "Charge", "Latency"].map(label => <th key={label} className="pb-3 pr-4 font-medium">{label}</th>)}</tr></thead>
				<tbody>{logs.data.items.map(row => <tr key={row.id} className="border-b border-border/50 align-top text-text-secondary">
					<td className="whitespace-nowrap py-3 pr-4 text-xs" title={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</td>
					<td className="max-w-[200px] break-words py-3 pr-4 text-xs" title={row.userId}>{row.userEmail ?? row.userName ?? row.userId}</td>
					<td className="max-w-[280px] py-3 pr-4"><details><summary className="cursor-pointer break-words font-mono text-xs text-text-bright">{row.model}</summary><dl className="mt-2 space-y-1 break-all text-xs"><dt>Request ID</dt><dd className="select-text font-mono">{row.requestId}</dd><dt>Requested model</dt><dd>{row.requestedModel ?? "Not recorded"}</dd><dt>Provider / route</dt><dd>{row.provider} / {row.routedVia ?? "Not recorded"}</dd><dt>Attempts</dt><dd>{row.attemptCount}</dd><dt>Upstream estimate</dt><dd>{row.upstreamCents == null ? "Unknown GNK cost" : dollars(row.upstreamCents)}</dd></dl></details></td>
					<td className={`py-3 pr-4 text-xs ${row.status === "error" ? "text-error" : ""}`}>{row.refundedAt ? "Refunded" : statuses[row.status] ?? row.status}{row.requestedModel && row.requestedModel !== row.model && <span className="mt-1 block text-warning">Model fallback</span>}</td>
					<td className="whitespace-nowrap py-3 pr-4 text-xs tabular-nums">{(row.inputTokens + row.outputTokens).toLocaleString()}<span className="mt-1 block text-text-muted">{row.inputTokens} in / {row.outputTokens} out</span></td>
					<td className="py-3 pr-4 font-mono text-xs">{dollars(row.billedCents)}</td><td className="py-3 text-xs tabular-nums">{row.latencyMs == null ? "—" : `${(row.latencyMs / 1000).toFixed(2)}s`}</td>
				</tr>)}</tbody></table></div>}
		<footer className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-text-muted">Page {previous.length + 1} · Up to 25 records per page</p><div className="flex gap-2">
			<button type="button" disabled={!previous.length || logs.isFetching} onClick={() => { setCursor(previous.at(-1) ?? null); setPrevious(previous.slice(0, -1)); }} className="min-h-11 rounded-md border border-border px-3 text-sm text-text-secondary disabled:opacity-40">Previous logs</button>
			<button type="button" disabled={!logs.data?.nextCursor || logs.isFetching} onClick={() => { setPrevious([...previous, cursor]); setCursor(logs.data?.nextCursor ?? null); }} className="min-h-11 rounded-md border border-border px-3 text-sm text-text-secondary disabled:opacity-40">Next logs</button>
		</div></footer>
	</section>;
}
