"use client";

/**
 * /admin — Operator dashboard.
 *
 * Role-gated (server session role === "admin"; wallet-gated server routes
 * stay server-side). Surfaces real aggregated operational data:
 *   - /v1/ops/snapshot — runtime, HTTP counters, 24h chat aggregates
 *   - /v1/models      — provider health (available vs missing keys)
 *
 * No per-user data is shown; that requires wallet admin routes.
 */

import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	Cpu,
	Gauge,
	ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/useAuth";

interface OpsSnapshot {
	status: "ok" | "degraded";
	version: string;
	env: string;
	uptimeSec: number;
	runtime: { heapUsedMb: number; rssMb: number; dbLatencyMs: number | null };
	http: {
		requestsTotal: number;
		errorsTotal: number;
		topRoutes: Array<{ route: string; requests: number; errors: number; p95ms: number }>;
	};
	chat24h: {
		completions: number;
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
		errors: number;
		p95LatencyMs: number | null;
		topModels: Array<{ model: string; requests: number; tokens: number }>;
	};
}

function StatCard({
	label,
	value,
	sub,
	icon,
	tone = "default",
}: {
	label: string;
	value: string;
	sub?: string;
	icon?: React.ReactNode;
	tone?: "default" | "warn" | "ok" | "danger";
}) {
	const toneCls = {
		default: "text-text-bright",
		warn: "text-warning",
		ok: "text-success",
		danger: "text-error",
	}[tone];
	return (
		<div className="flex flex-col gap-1 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
			<div className="flex items-center justify-between gap-2">
				<span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
					{label}
				</span>
				{icon}
			</div>
			<span className={`font-mono text-xl font-bold tabular-nums ${toneCls}`}>
				{value}
			</span>
			{sub && <span className="text-[10px] font-mono text-text-muted">{sub}</span>}
		</div>
	);
}

function fmtMs(ms: number | null): string {
	if (ms == null) return "—";
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function fmtUptime(sec: number): string {
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminPage() {
	const { isReady, isAuthenticated, isAdmin, user } = useAuth();
	
	if (isReady && !isAdmin) {
		return (
			<div className="flex min-h-screen items-center justify-center p-4 text-center bg-void text-text">
				<div>
					<h1 className="text-2xl font-bold mb-2">404</h1>
					<p className="text-text-muted">This page could not be found.</p>
				</div>
			</div>
		);
	}

	const snapshot = useQuery({
		queryKey: ["ops", "snapshot"],
		queryFn: async () => {
			const res = await fetch("/api/v1/ops/snapshot", {
				credentials: "include",
				headers: { Accept: "application/json" },
			});
			if (!res.ok) throw new Error(`ops snapshot ${res.status}`);
			return (await res.json()) as OpsSnapshot;
		},
		refetchInterval: 60_000,
		staleTime: 30_000,
		enabled: isReady && isAdmin,
	});

	const models = useQuery({
		queryKey: ["models"],
		queryFn: () => api.models.list(),
		refetchInterval: 300_000,
		staleTime: 120_000,
		enabled: isReady && isAdmin,
	});

	const providerHealth = useMemo(() => {
		const byProvider = new Map<string, { total: number; available: number }>();
		for (const raw of models.data?.data ?? []) {
			const m = raw as { provider?: string; available?: boolean };
			const p = m.provider ?? "unknown";
			const cur = byProvider.get(p) ?? { total: 0, available: 0 };
			cur.total += 1;
			if (m.available !== false) cur.available += 1;
			byProvider.set(p, cur);
		}
		return [...byProvider.entries()];
	}, [models.data]);

	if (!isReady) {
		return (
			<div className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
				<div className="h-8 w-48 animate-shimmer rounded bg-surface-elevated" />
				<div className="h-40 w-full animate-shimmer rounded bg-surface-elevated" />
			</div>
		);
	}

	if (!isAuthenticated || !isAdmin) {
		return (
			<div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-24 text-center">
				<ShieldCheck className="h-10 w-10 text-text-muted" />
				<h1 className="text-lg font-semibold text-text">Admin access required</h1>
				<p className="max-w-md text-sm text-text-secondary">
					This dashboard is restricted to operators with an admin role on the
					account {user?.email ? `(${user.email})` : ""}. Sign in with an admin
					account to continue.
				</p>
				<Link
					href="/login"
					className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-secondary transition-colors hover:border-accent/50 hover:text-text-bright"
				>
					Sign in
				</Link>
			</div>
		);
	}

	const snap = snapshot.data;

	return (
		<div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-widest text-text-bright">
						<ShieldCheck className="h-4 w-4 text-accent" />
						Admin · Operator dashboard
					</h1>
					<p className="mt-1 text-xs text-text-muted">
						Live operational snapshot — refreshed every 60s. Signed in as{" "}
						<span className="text-text-secondary">{user?.email ?? "unknown"}</span>
					</p>
				</div>
				{snap && (
					<span
						className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
							snap.status === "ok"
								? "border-success/30 bg-success/10 text-success"
								: "border-warning/30 bg-warning/10 text-warning"
						}`}
					>
						{snap.status === "ok" ? (
							<CheckCircle2 className="h-3 w-3" />
						) : (
							<AlertTriangle className="h-3 w-3" />
						)}
						{snap.status} · v{snap.version} · {snap.env}
					</span>
				)}
			</header>

			{snapshot.isError && (
				<div className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-error/30 bg-error/10 px-4 py-3 text-xs text-error">
					<AlertTriangle className="h-4 w-4 shrink-0" />
					Failed to load ops snapshot — is the API server running?
				</div>
			)}

			{snap && (
				<section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Runtime">
					<StatCard
						label="Uptime"
						value={fmtUptime(snap.uptimeSec)}
						icon={<Activity className="h-3.5 w-3.5 text-text-muted" />}
					/>
					<StatCard
						label="Heap / RSS"
						value={`${snap.runtime.heapUsedMb} MB`}
						sub={`RSS ${snap.runtime.rssMb} MB`}
						icon={<Cpu className="h-3.5 w-3.5 text-text-muted" />}
					/>
					<StatCard
						label="DB latency"
						value={fmtMs(snap.runtime.dbLatencyMs)}
						tone={snap.runtime.dbLatencyMs != null && snap.runtime.dbLatencyMs < 200 ? "ok" : "warn"}
						icon={<Gauge className="h-3.5 w-3.5 text-text-muted" />}
					/>
					<StatCard
						label="HTTP errors"
						value={String(snap.http.errorsTotal)}
						sub={`of ${snap.http.requestsTotal} requests`}
						tone={snap.http.errorsTotal > 0 ? "warn" : "ok"}
						icon={<Activity className="h-3.5 w-3.5 text-text-muted" />}
					/>
				</section>
			)}

			{snap && (
				<section
					className="grid grid-cols-2 gap-3 md:grid-cols-4"
					aria-label="Chat traffic 24h"
				>
					<StatCard label="Completions 24h" value={String(snap.chat24h.completions)} />
					<StatCard
						label="Tokens 24h"
						value={snap.chat24h.totalTokens.toLocaleString()}
						sub={`${snap.chat24h.inputTokens.toLocaleString()} in · ${snap.chat24h.outputTokens.toLocaleString()} out`}
					/>
					<StatCard
						label="Errors 24h"
						value={String(snap.chat24h.errors)}
						tone={snap.chat24h.errors > 0 ? "warn" : "ok"}
					/>
					<StatCard
						label="p95 latency"
						value={fmtMs(snap.chat24h.p95LatencyMs)}
					/>
				</section>
			)}

			<div className="grid gap-3 md:grid-cols-2">
				{snap && (
					<section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4" aria-label="Top models">
						<h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
							Top models · 24h
						</h2>
						{snap.chat24h.topModels.length === 0 ? (
							<p className="text-xs text-text-muted">No traffic recorded yet.</p>
						) : (
							<ul className="flex flex-col gap-1.5">
								{snap.chat24h.topModels.map((m) => (
									<li
										key={m.model}
										className="flex items-center justify-between gap-3 text-xs"
									>
										<span className="min-w-0 truncate font-mono text-text-secondary">
											{m.model}
										</span>
										<span className="shrink-0 tabular-nums text-text-muted">
											{m.requests} req · {m.tokens.toLocaleString()} tok
										</span>
									</li>
								))}
							</ul>
						)}
					</section>
				)}

				<section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4" aria-label="Provider health">
					<h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
						Provider health
					</h2>
					{models.isLoading ? (
						<p className="text-xs text-text-muted">Loading catalog…</p>
					) : providerHealth.length === 0 ? (
						<p className="text-xs text-text-muted">No models reported.</p>
					) : (
						<ul className="flex flex-col gap-1.5">
							{providerHealth.map(([provider, { total, available }]) => {
								const allUp = available === total;
								return (
									<li
										key={provider}
										className="flex items-center justify-between gap-3 text-xs"
									>
										<span className="font-mono text-text-secondary uppercase">
											{provider}
										</span>
										<span
											className={`inline-flex items-center gap-1.5 tabular-nums ${
												allUp ? "text-success" : "text-warning"
											}`}
										>
											{allUp ? (
												<CheckCircle2 className="h-3 w-3" />
											) : (
												<AlertTriangle className="h-3 w-3" />
											)}
											{available}/{total} keys ok
										</span>
									</li>
								);
							})}
						</ul>
					)}
					<p className="mt-3 text-[10px] leading-relaxed text-text-muted">
						Models behind a provider with a missing/placeholder API key are
						disabled in the chat model selector.
					</p>
				</section>
			</div>
		</div>
	);
}
