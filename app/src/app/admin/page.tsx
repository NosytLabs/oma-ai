"use client";

/**
	* /admin — Operator dashboard.
	*
	* Role-gated (server session role === "admin"; wallet-gated server routes
	* stay server-side). Surfaces real aggregated operational data:
	*   - /v1/ops/snapshot — runtime, HTTP counters, 24h chat aggregates
	*   - /v1/models      — provider health (available vs missing keys)
	*   - /v1/admin/users — paginated user list + balance
	*   - /v1/admin/site-settings — kill switch toggles
	*/

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	Cpu,
	Gauge,
	Loader2,
	PowerOff,
	ShieldCheck,
	UserMinus,
	UserPlus,
	Users as UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/hooks/useAuth";
import { useDialog } from "@/lib/use-dialog";
import { useToast } from "@/components/ui/Toast";

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

	if (!isAuthenticated) {
		return (
			<div className="mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center gap-4 px-6 py-24 text-center">
				<ShieldCheck className="h-10 w-10 text-text-muted" />
				<h2 className="text-lg font-semibold text-text">Admin access required</h2>
				<p className="max-w-md text-sm text-text-secondary">
					This dashboard is restricted to operators with an admin role.
					Sign in with an admin account to continue.
				</p>
				<Link
					href="/login?next=/admin"
					className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-secondary transition-colors hover:border-accent/50 hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					Sign in
				</Link>
			</div>
		);
	}

	if (!isAdmin) {
		return (
			<div className="mx-auto flex min-h-[60vh] max-w-5xl flex-col items-center justify-center gap-4 px-6 py-24 text-center">
				<ShieldCheck className="h-10 w-10 text-text-muted" />
				<h2 className="text-lg font-semibold text-text">Access denied</h2>
				<p className="max-w-md text-sm text-text-secondary">
					This dashboard is restricted to operators with an admin role.
				</p>
				<Link
					href="/"
					className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-secondary transition-colors hover:border-accent/50 hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					Back to home
				</Link>
			</div>
		);
	}

	const snap = snapshot.data;

	return (
		<div
			className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6"
			aria-busy={snapshot.isLoading || models.isLoading}
		>
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
			{snapshot.isLoading && !snap && (
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4" role="status">
					{["runtime-a", "runtime-b", "runtime-c", "runtime-d"].map((id) => (
						<div key={id} className="h-24 animate-shimmer rounded-[var(--radius-lg)] border border-border bg-surface" />
					))}
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
						tone={snap.runtime.dbLatencyMs === null ? "default" : snap.runtime.dbLatencyMs < 200 ? "ok" : "warn"}
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
					className="grid grid-cols-2 gap-3 md:grid-cols-5"
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
					<StatCard
						label="Active Models"
						value={String(snap.chat24h.topModels.length)}
					/>
				</section>
			)}

			<div className="grid gap-3 md:grid-cols-3">
				{snap && (
					<section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4" aria-label="Top routes">
						<h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
							Top HTTP Routes
						</h2>
						{snap.http.topRoutes.length === 0 ? (
							<p className="text-xs text-text-muted">No route traffic recorded yet.</p>
						) : (
							<ul className="flex flex-col gap-1.5">
								{snap.http.topRoutes.map((r, i) => (
									<li
										key={`${r.route}:${i}`}
										className="flex items-center justify-between gap-3 text-xs"
									>
										<span className="min-w-0 truncate font-mono text-text-secondary" title={r.route}>
											{r.route}
										</span>
										<span className="shrink-0 tabular-nums text-text-muted">
											{r.requests} req · {r.errors} err · {fmtMs(r.p95ms)}
										</span>
									</li>
								))}
							</ul>
						)}
					</section>
				)}

				{snap && (
					<section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4" aria-label="Top models">
						<h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
							Top models · 24h
						</h2>
						{snap.chat24h.topModels.length === 0 ? (
							<p className="text-xs text-text-muted">No traffic recorded yet.</p>
						) : (
							<ul className="flex flex-col gap-1.5">
								{snap.chat24h.topModels.map((m, i) => (
									<li
										key={`${m.model}:${i}`}
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
							{providerHealth.map(([provider, { total, available }], i) => {
								const allUp = available === total;
								return (
									<li
										key={`${provider}:${i}`}
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

				<SiteSettingsSection />
				<RateLimitSection />
			</div>
			<UsersSection />
		</div>
	);
}

/* =============================================================================
			Operator controls — users, site settings
			============================================================================= */

interface AdminUser {
	id: string;
	email: string | null;
	name: string | null;
	role: string | null;
	suspended: boolean;
	suspendedReason: string | null;
	createdAt: string | null;
	balanceCents: string;
	totalDepositedCents: string;
}

type AdminDialog =
	| { kind: "credit"; user: AdminUser }
	| { kind: "suspend"; user: AdminUser };

function UsersSection() {
	const toast = useToast();
	const [q, setQ] = useState("");
	const [debouncedQ, setDebouncedQ] = useState("");
	const [cursor, setCursor] = useState<string | null>(null);
	const [pages, setPages] = useState<AdminUser[][]>([]);
	const [dialog, setDialog] = useState<AdminDialog | null>(null);
	const queryClient = useQueryClient();

	useEffect(() => {
		const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
		return () => window.clearTimeout(t);
	}, [q]);

	const users = useQuery({
		queryKey: ["admin-users", debouncedQ, cursor],
		queryFn: async () => {
			const params = new URLSearchParams({ limit: "50" });
			if (debouncedQ) params.set("q", debouncedQ);
			if (cursor) params.set("cursor", cursor);
			const res = await fetch(`/api/v1/admin/users?${params.toString()}`, {
				credentials: "include",
				headers: { Accept: "application/json" },
			});
			if (!res.ok) throw new Error(`list users failed: ${res.status}`);
			return (await res.json()) as { items: AdminUser[]; nextCursor: string | null };
		},
		staleTime: 30_000,
	});

	useEffect(() => {
		setCursor(null);
		setPages([]);
	}, [debouncedQ]);

	useEffect(() => {
		if (!users.data?.items) return;
		setPages((prev) => {
			if (!cursor) return [users.data.items];
			if (prev.some((page) => page[0]?.id === users.data.items[0]?.id)) return prev;
			return [...prev, users.data.items];
		});
	}, [users.data, cursor]);

	const items = pages.flat();
	const nextCursor = users.data?.nextCursor ?? null;

	const suspend = useMutation({
		mutationFn: async (input: { userId: string; suspended: boolean; reason: string }) => {
			const res = await fetch("/api/v1/admin/user-suspend", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify(input),
			});
			if (!res.ok) throw new Error(`suspend failed: ${res.status}`);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
			toast.success("User status updated");
			setDialog(null);
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to update user status");
		},
	});

	const creditAdjust = useMutation({
		mutationFn: async (input: {
			userId: string;
			deltaCents: number;
			reason: string;
		}) => {
			const res = await fetch("/api/v1/admin/credit-adjust", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify(input),
			});
			if (!res.ok) throw new Error(`credit adjust failed: ${res.status}`);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
			toast.success("Credits adjusted");
			setDialog(null);
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to adjust credits");
		},
	});

	return (
		<section
			className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
			aria-label="User management"
		>
			<header className="mb-3 flex flex-wrap items-center justify-between gap-3">
				<h2 className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
					Users
				</h2>
				<input
					type="search"
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder="Search email or name…"
					className="min-w-0 w-full rounded-[var(--radius-md)] border border-border bg-void px-2.5 py-1.5 text-xs text-text-bright placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-56"
				/>
			</header>

			{users.isLoading && items.length === 0 ? (
				<p className="text-xs text-text-muted">Loading users…</p>
			) : users.isError && items.length === 0 ? (
				<p className="text-xs text-error">Failed to load users.</p>
			) : items.length === 0 ? (
				<p className="text-xs text-text-muted">No users found.</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-left text-xs">
						<thead className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
							<tr>
								<th className="py-1.5 pr-3">Email</th>
								<th className="py-1.5 pr-3">Role</th>
								<th className="py-1.5 pr-3">Balance</th>
								<th className="py-1.5 pr-3">Status</th>
								<th className="py-1.5 pr-3">Created</th>
								<th className="py-1.5 pr-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{items.map((u) => (
								<tr
									key={u.id}
									className="border-t border-border/40 hover:bg-surface/40"
								>
									<td className="py-2 pr-3 font-mono text-text-secondary">
										{u.email ?? <span className="text-text-muted">—</span>}
									</td>
									<td className="py-2 pr-3 font-mono text-[10px] uppercase tracking-wider text-text-muted">
										{u.role ?? "user"}
									</td>
									<td className="py-2 pr-3 font-mono tabular-nums">
										${(Number(u.balanceCents) / 100).toFixed(2)}
									</td>
									<td className="py-2 pr-3">
										{u.suspended ? (
											<span className="inline-flex items-center gap-1 rounded-full border border-error/30 bg-error/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-error">
												Suspended
											</span>
										) : (
											<span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-success">
												Active
											</span>
										)}
									</td>
									<td className="py-2 pr-3 font-mono text-[10px] text-text-muted">
										{u.createdAt
											? new Date(u.createdAt).toLocaleDateString()
											: "—"}
									</td>
									<td className="py-2 pr-3 text-right">
										<div className="inline-flex items-center gap-1">
											<button
												type="button"
												onClick={() => setDialog({ kind: "credit", user: u })}
													className="rounded-[var(--radius-sm)] border border-border bg-surface px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-text-secondary hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
													aria-label={`Adjust credits for ${u.email ?? u.id}`}
													title="Adjust credits"
											>
												<UsersIcon className="h-3 w-3" />
											</button>
											<button
												type="button"
												onClick={() => setDialog({ kind: "suspend", user: u })}
													className={`rounded-[var(--radius-sm)] border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${
													u.suspended
														? "border-success/30 bg-success/10 text-success hover:border-success/50"
														: "border-error/30 bg-error/10 text-error hover:border-error/50"
													}`}
													aria-label={`${u.suspended ? "Unsuspend" : "Suspend"} ${u.email ?? u.id}`}
													title={u.suspended ? "Unsuspend" : "Suspend"}
											>
												{u.suspended ? (
													<UserPlus className="h-3 w-3" />
												) : (
													<UserMinus className="h-3 w-3" />
												)}
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{nextCursor && (
				<button
					type="button"
					onClick={() => setCursor(String(nextCursor))}
					disabled={users.isFetching}
					className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-void px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-text-secondary hover:border-accent/40 hover:text-accent disabled:opacity-50"
				>
					{users.isFetching ? "Loading…" : "Load more"}
				</button>
			)}

			{(creditAdjust.isError || suspend.isError) && (
				<p className="mt-3 text-xs text-error">
					{(creditAdjust.error as Error)?.message ??
						(suspend.error as Error)?.message ??
						"Action failed."}
				</p>
			)}

			{dialog && (
				<AdminActionDialog
					dialog={dialog}
					busy={creditAdjust.isPending || suspend.isPending}
					onClose={() => setDialog(null)}
					onCredit={(deltaCents, reason) =>
						creditAdjust.mutate({
							userId: dialog.user.id,
							deltaCents,
							reason,
						})
					}
					onSuspend={(reason) =>
						suspend.mutate({
							userId: dialog.user.id,
							suspended: !dialog.user.suspended,
							reason,
						})
					}
				/>
			)}
		</section>
	);
}

function AdminActionDialog({
	dialog,
	busy,
	onClose,
	onCredit,
	onSuspend,
}: {
	dialog: AdminDialog;
	busy: boolean;
	onClose: () => void;
	onCredit: (deltaCents: number, reason: string) => void;
	onSuspend: (reason: string) => void;
}) {
	const { panelRef } = useDialog({ open: true, onClose });
	const [dollars, setDollars] = useState("1.00");
	const [reason, setReason] = useState(
		dialog.kind === "credit"
			? "admin adjustment"
			: dialog.user.suspended
				? "unsuspend"
				: "policy violation",
	);
	const who = dialog.user.email ?? dialog.user.id;
	const deltaCents = Math.round(Number(dollars) * 100);
	const creditValid = Number.isFinite(deltaCents) && deltaCents !== 0;
	const reasonValid = reason.trim().length >= 3;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="admin-action-title"
		>
			<div ref={panelRef} tabIndex={-1} className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-panel p-5 shadow-xl">
				<h3
					id="admin-action-title"
					className="text-sm font-semibold text-text-bright"
				>
					{dialog.kind === "credit"
						? `Adjust credits · ${who}`
						: dialog.user.suspended
							? `Unsuspend · ${who}`
							: `Suspend · ${who}`}
				</h3>
				{dialog.kind === "credit" ? (
					<label className="mt-4 block text-xs text-text-muted">
						Amount in dollars (negative deducts)
						<input
							type="number"
							step="0.01"
							value={dollars}
							onChange={(e) => setDollars(e.target.value)}
							className="mt-1.5 min-h-11 w-full rounded-[var(--radius-md)] border border-border bg-void px-3 text-sm text-text-bright focus:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						/>
					</label>
				) : (
					<p className="mt-3 text-xs text-text-secondary">
						This is written to the audit log. Type a reason of at least 3
						characters.
					</p>
				)}
				<label className="mt-3 block text-xs text-text-muted">
					Reason
					<input
						type="text"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						className="mt-1.5 min-h-11 w-full rounded-[var(--radius-md)] border border-border bg-void px-3 text-sm text-text-bright focus:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					/>
				</label>
				<div className="mt-5 flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						disabled={busy}
						className="btn-secondary h-10 px-4 text-xs"
					>
						Cancel
					</button>
					<button
						type="button"
						disabled={
							busy ||
							!reasonValid ||
							(dialog.kind === "credit" && !creditValid)
						}
						onClick={() => {
							if (dialog.kind === "credit") onCredit(deltaCents, reason.trim());
							else onSuspend(reason.trim());
						}}
						className="btn-primary h-10 px-4 text-xs disabled:opacity-40"
					>
						{busy ? "Saving…" : "Confirm"}
					</button>
				</div>
			</div>
		</div>
	);
}

function RateLimitSection() {
	const [userId, setUserId] = useState("");
	const [rpm, setRpm] = useState("120");
	const [reason, setReason] = useState("operator override");
	const [status, setStatus] = useState<string | null>(null);
	const mutate = useMutation({
		mutationFn: async (input: {
			userId: string;
			maxRequestsPerMinute: number | null;
			reason: string;
		}) => {
			const res = await fetch("/api/v1/admin/rate-limit-override", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify(input),
			});
			if (!res.ok) throw new Error(`override failed: ${res.status}`);
			return res.json() as Promise<{ ok: boolean; maxRequestsPerMinute: number | null }>;
		},
		onSuccess: (data) => {
			setStatus(
				data.maxRequestsPerMinute == null
					? "Override cleared"
					: `Override set to ${data.maxRequestsPerMinute}/min`,
			);
		},
		onError: (err) => {
			setStatus(err instanceof Error ? err.message : "Override failed");
		},
	});

	const trimmed = userId.trim();
	const rpmNum = Number.parseInt(rpm, 10);

	return (
		<section
			className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
			aria-label="Rate-limit overrides"
		>
			<h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
				Rate-limit override
			</h2>
			<p className="mb-3 text-[11px] text-text-muted">
				Set a per-user requests/minute cap, or clear an existing override.
			</p>
			<div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))" }}>
				<input
					type="text"
					value={userId}
					onChange={(e) => setUserId(e.target.value)}
					placeholder="User ID"
					aria-label="User ID"
					className="min-w-0 rounded-[var(--radius-md)] border border-border bg-void px-2.5 py-1.5 font-mono text-xs text-text-bright placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				/>
				<input
					type="number"
					min={1}
					max={10000}
					value={rpm}
					onChange={(e) => setRpm(e.target.value)}
					aria-label="Requests per minute"
					className="min-w-0 rounded-[var(--radius-md)] border border-border bg-void px-2.5 py-1.5 font-mono text-xs text-text-bright focus:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				/>
				<input
					type="text"
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					placeholder="Reason"
					aria-label="Override reason"
					className="min-w-0 rounded-[var(--radius-md)] border border-border bg-void px-2.5 py-1.5 text-xs text-text-bright placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				/>
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					disabled={mutate.isPending || !trimmed || !Number.isFinite(rpmNum)}
					onClick={() =>
						mutate.mutate({
							userId: trimmed,
							maxRequestsPerMinute: rpmNum,
							reason: reason.trim() || "operator override",
						})
					}
					className="rounded-[var(--radius-md)] border border-accent/30 bg-accent/10 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-accent hover:bg-accent/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					Apply
				</button>
				<button
					type="button"
					disabled={mutate.isPending || !trimmed}
					onClick={() =>
						mutate.mutate({
							userId: trimmed,
							maxRequestsPerMinute: null,
							reason: reason.trim() || "clear override",
						})
					}
					className="rounded-[var(--radius-md)] border border-border bg-void px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-text-secondary hover:border-error/40 hover:text-error disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					Clear
				</button>
			</div>
			{status && (
				<p className="mt-2 text-[11px] text-text-muted" role="status">
					{status}
				</p>
			)}
		</section>
	);
}

function SiteSettingsSection() {
	const [maintenance, setMaintenance] = useState(false);
	const [cardEnabled, setCardEnabled] = useState(true);
	const [cryptoEnabled, setCryptoEnabled] = useState(true);
	const [message, setMessage] = useState("");
	const queryClient = useQueryClient();
	const current = useQuery({
		queryKey: ["site-settings"],
		queryFn: async () => {
			const res = await fetch("/api/v1/site-settings", {
				credentials: "include",
				headers: { Accept: "application/json" },
			});
			if (!res.ok) throw new Error(`site-settings ${res.status}`);
			return (await res.json()) as {
				maintenanceMode?: boolean;
				cardPaymentsEnabled?: boolean;
				cryptoPaymentsEnabled?: boolean;
				maintenanceMessage?: string;
			};
		},
		staleTime: 15_000,
	});
	useEffect(() => {
		const data = current.data;
		if (!data) return;
		setMaintenance(Boolean(data.maintenanceMode));
		setCardEnabled(data.cardPaymentsEnabled !== false);
		setCryptoEnabled(data.cryptoPaymentsEnabled !== false);
		setMessage(data.maintenanceMessage ?? "");
	}, [current.data]);

	const setSettings = useMutation({
		mutationFn: async (input: {
			maintenanceMode?: boolean;
			cardPaymentsEnabled?: boolean;
			cryptoPaymentsEnabled?: boolean;
			maintenanceMessage?: string;
		}) => {
			const res = await fetch("/api/v1/admin/site-settings", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify(input),
			});
			if (!res.ok) throw new Error(`site-settings failed: ${res.status}`);
			return res.json();
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["site-settings"] });
		},
	});

	return (
		<section
			className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
			aria-label="Site settings"
		>
			<header className="mb-3 flex items-center justify-between gap-3">
				<h2 className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
					Kill switches
				</h2>
				{setSettings.isPending && (
					<Loader2 className="h-3 w-3 animate-spin text-text-muted" />
				)}
			</header>

			<div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
				<ToggleRow
					label="Maintenance mode"
					hint="Returns 503 to all routes except /health."
					checked={maintenance}
					onChange={setMaintenance}
					tone="danger"
				/>
				<ToggleRow
					label="Card payments"
					hint="Disable Polar checkout (USDC + x402 remain)."
					checked={cardEnabled}
					onChange={setCardEnabled}
				/>
				<ToggleRow
					label="Crypto payments"
					hint="Disable USDC + x402 deposits (card remains)."
					checked={cryptoEnabled}
					onChange={setCryptoEnabled}
				/>
			</div>

			<label className="mt-4 block text-xs font-mono text-text-muted">
				Maintenance message
				<input
					type="text"
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					placeholder="Be back in 30 minutes."
					maxLength={500}
					className="mt-1 w-full rounded-[var(--radius-md)] border border-border bg-void px-2.5 py-1.5 text-xs text-text-bright placeholder:text-text-muted focus:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				/>
			</label>

			<div className="mt-4 flex items-center justify-end gap-2">
				<button
					type="button"
					disabled={setSettings.isPending || current.isLoading}
					onClick={() =>
						setSettings.mutate({
							maintenanceMode: maintenance,
							cardPaymentsEnabled: cardEnabled,
							cryptoPaymentsEnabled: cryptoEnabled,
							maintenanceMessage: message,
						})
					}
					className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-accent/15 px-3 py-1.5 text-xs font-mono text-accent transition hover:bg-accent/25 disabled:opacity-50"
				>
					<PowerOff className="h-3 w-3" />
					Apply changes
				</button>
			</div>

			{setSettings.isError && (
				<p className="mt-3 text-xs text-error">
					{(setSettings.error as Error)?.message ?? "Failed to save."}
				</p>
			)}
			{setSettings.isSuccess && (
				<p className="mt-3 text-xs text-success">Saved. Audit log written.</p>
			)}
		</section>
	);
}

function ToggleRow({
	label,
	hint,
	checked,
	onChange,
	tone = "default",
}: {
	label: string;
	hint: string;
	checked: boolean;
	onChange: (v: boolean) => void;
	tone?: "default" | "danger";
}) {
	return (
		<label className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-void/40 p-3">
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				onClick={() => onChange(!checked)}
				className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition ${
					checked
						? tone === "danger"
							? "border-error/40 bg-error/40"
							: "border-accent/40 bg-accent/40"
						: "border-border bg-surface"
				}`}
			>
				<span
					className={`inline-block h-3 w-3 rounded-full bg-text-bright transition ${
						checked ? "translate-x-5" : "translate-x-1"
					}`}
				/>
			</button>
			<span className="min-w-0">
				<span className="block text-xs font-semibold text-text-bright">{label}</span>
				<span className="mt-0.5 block text-[10px] leading-relaxed text-text-muted">
					{hint}
				</span>
			</span>
		</label>
	);
}
