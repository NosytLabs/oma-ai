
type TimeWindow = "7d" | "24h" | "30d";

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
	AlertTriangle,
	ArrowUpRight,
	CheckCircle2,
	ChevronRight,
	Coins,
	CreditCard,
	CircleDot,
	Loader2,
	Settings2,
	ShieldCheck,
	XCircle,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/components/ui/Toast";

type UsageTotals = {
	requests: number;
	inputTokens: number;
	outputTokens: number;
	costCents: number;
	markupCents: number;
	totalCents: number;
};

type PerModel = {
	model: string;
	provider: string;
	requests: number;
	inputTokens: number;
	outputTokens: number;
	totalCents: number;
};

type UsageResponse = {
	window: string;
	since: string;
	totals: UsageTotals;
	perModel: PerModel[];
};

type ModelRow = {
	id: string;
	displayName: string;
	provider: string;
	gonkaId: string | null;
	category: string;
	inputPricePer1M: number;
	outputPricePer1M: number;
	markupPercent: number;
	contextWindow: number | null;
	maxTokens: number;
	supportsStreaming: boolean;
	supportsTools: boolean;
	override: { inputPricePer1M: number; outputPricePer1M: number; updatedAt: string } | null;
};

type RecentRow = {
	id: string;
	requestId: string;
	userId: string;
	model: string;
	provider: string;
	inputTokens: number;
	outputTokens: number;
	costCents: string;
	totalCents: string;
	status: string;
	createdAt: string;
};

type Integration = {
	polar: {
		configured: boolean;
		server: string;
		organizationId: string | null;
		note: string;
	};
	gonka: {
		configured: boolean;
		url: string;
		health: { status: "healthy" | "degraded" | "down"; latencyMs?: number; note?: string };
	};
	venice: {
		configured: boolean;
		url: string;
		private: boolean;
	};
	resend: { configured: boolean; from: string };
	node_env: string;
	dailyLimits: { anonymous: number; registered: number };
};

type Health = {
	status: string;
	version: string;
	env: string;
	uptime_s: number;
	memory: { rss_mb: number; heap_used_mb: number };
	db: string;
	timestamp: string;
};

type PolarPayment = { id: string; amount: number; currency: string; status: string; customer_email: string; metadata: Record<string, unknown> };
type PolarCustomer = { id: string; email: string; name: string; metadata: Record<string, unknown> };
type PolarProduct = { id: string; name: string; description: string; type: string; pricing: { type: string; amount?: number; currency?: string; interval?: string } };
type PolarSubscription = { id: string; customer_id: string; product_id: string; status: string; started_at: string; current_period_end: string };
type PolarCheckout = { id: string; checkout_url: string; product_id: string; customer_email: string; status: string };

type PolarTab = "payments" | "customers" | "checkouts" | "products" | "subscriptions";

const ADMIN_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${ADMIN_BASE}${path}`, {
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
		...init,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`${res.status}: ${text || res.statusText}`);
	}
	return res.json() as Promise<T>;
}

function centsToDollars(cents: number) {
	if (!isFinite(cents)) return "$0.00";
	return `$${(cents / 100).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	})}`;
}

function formatTokens(n: number) {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

function timeAgo(iso: string) {
	const ms = Date.now() - new Date(iso).getTime();
	if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
	if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
	if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
	return `${Math.floor(ms / 86_400_000)}d ago`;
}

async function polarFetch<T>(path: string): Promise<T> {
	const res = await fetch(`${ADMIN_BASE}${path}`, {
		credentials: "include",
		headers: { "Content-Type": "application/json" },
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`${res.status}: ${text || res.statusText}`);
	}
	return res.json() as Promise<T>;
}

export function AdminDashboard() {
	const toast = useToast();
	const [windowSel, setWindowSel] = useState<TimeWindow>("7d");
	const [usage, setUsage] = useState<UsageResponse | null>(null);
	const [models, setModels] = useState<ModelRow[]>([]);
	const [recent, setRecent] = useState<RecentRow[]>([]);
	const [health, setHealth] = useState<Health | null>(null);
	const [integrations, setIntegrations] = useState<Integration | null>(null);
	const [role, setRole] = useState<string | null>(null);
	const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
	const [promoting, setPromoting] = useState(false);
	const [loading, setLoading] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editInput, setEditInput] = useState("");
	const [editOutput, setEditOutput] = useState("");
	// Polar management state
	const [polarTab, setPolarTab] = useState<PolarTab>("payments");
	const [polarPayments, setPolarPayments] = useState<PolarPayment[]>([]);
	const [polarCustomers, setPolarCustomers] = useState<PolarCustomer[]>([]);
	const [polarProducts, setPolarProducts] = useState<PolarProduct[]>([]);
	const [polarSubscriptions, setPolarSubscriptions] = useState<PolarSubscription[]>([]);
	const [polarLoading, setPolarLoading] = useState(false);
	const [polarError, setPolarError] = useState<string | null>(null);
	// Checkout form
	const [checkoutProduct, setCheckoutProduct] = useState("");
	const [checkoutEmail, setCheckoutEmail] = useState("");
	const [checkoutName, setCheckoutName] = useState("");
	const [checkoutSuccess, setCheckoutSuccess] = useState("");
	const [checkoutCancel, setCheckoutCancel] = useState("");
	const [checkoutResult, setCheckoutResult] = useState<PolarCheckout | null>(null);

	const refreshAll = useCallback(async () => {
		setLoading(true);
		try {
			const sessionData = await authClient.getSession();
			const userRole =
				((sessionData?.data?.user as { role?: string } | undefined)?.role ??
					null) as string | null;
			setRole(userRole);
			setIsAdmin(userRole === "admin");

			if (userRole !== "admin") {
				setLoading(false);
				return;
			}

			const [u, m, r, h, i] = await Promise.all([
				adminFetch<UsageResponse>(`/v1/admin/usage?window=${windowSel}`),
				adminFetch<{ data: ModelRow[] }>(`/v1/admin/models`),
				adminFetch<{ data: RecentRow[] }>(
					`/v1/admin/usage/recent?limit=30`,
				),
				adminFetch<Health>(`/v1/admin/health`),
				adminFetch<Integration>(`/v1/admin/integrations`),
			]);
			setUsage(u);
			setModels(m.data);
			setRecent(r.data);
			setHealth(h);
			setIntegrations(i);
		} catch (err) {
			toast.error(`Failed to load admin data: ${(err as Error).message}`);
		} finally {
			setLoading(false);
		}
	}, [toast, windowSel]);

	useEffect(() => {
		void refreshAll();
	}, [refreshAll]);

	const handlePromote = async () => {
		setPromoting(true);
		try {
			await adminFetch("/v1/admin/promote-self", { method: "POST" });
			toast.success("Promoted to admin — refresh to see the panel.");
			await refreshAll();
		} catch (err) {
			toast.error(`Promote failed: ${(err as Error).message}`);
		} finally {
			setPromoting(false);
		}
	};

	const handleEdit = async (modelId: string) => {
		try {
			await adminFetch(`/v1/admin/models/${modelId}`, {
				method: "PATCH",
				body: JSON.stringify({
					inputPricePer1M: Number(editInput),
					outputPricePer1M: Number(editOutput),
				}),
			});
			toast.success(`Updated pricing for ${modelId}`);
			setEditingId(null);
			await refreshAll();
		} catch (err) {
			toast.error(`Update failed: ${(err as Error).message}`);
		}
	};

	const startEdit = (m: ModelRow) => {
		setEditingId(m.id);
		setEditInput(String(m.inputPricePer1M));
		setEditOutput(String(m.outputPricePer1M));
	};

	const totalMarginPct = useMemo(() => {
		if (!usage) return 0;
		const { costCents, markupCents } = usage.totals;
		const base = costCents + markupCents;
		if (base <= 0) return 0;
		return (markupCents / base) * 100;
	}, [usage]);

	if (isAdmin === null) {
		return (
			<div className="flex items-center gap-2 text-text-muted">
				<Loader2 className="h-4 w-4 animate-spin" /> Loading admin panel…
			</div>
		);
	}

	if (!isAdmin) {
		return (
			<div className="mx-auto mt-12 max-w-xl rounded-lg border border-border bg-surface-elevated/40 p-6 text-center">
				<ShieldCheck className="mx-auto mb-3 h-8 w-8 text-accent" />
				<h2 className="mb-2 text-lg font-medium">Admin access required</h2>
				<p className="mb-4 text-sm text-text-muted">
					You are signed in as <span className="font-mono">{role ?? "user"}</span>.
					Admins can edit model pricing, view usage analytics, and manage
					integrations.
				</p>
				<button
					type="button"
					onClick={handlePromote}
					disabled={promoting}
					className="inline-flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium hover:bg-accent/20 disabled:opacity-50"
				>
					{promoting ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<ShieldCheck className="h-4 w-4" />
					)}
					{role === "admin" ? "Already admin" : "Promote me to admin (dev)"}
				</button>
			</div>
		);
	}

	if (loading && !usage) {
		return (
			<div className="flex items-center gap-2 text-text-muted">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading dashboard…
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold">Operator dashboard</h1>
					<p className="text-sm text-text-muted">
						Live OMA-AI usage, pricing, and integration health.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex rounded-md border border-border bg-surface-elevated/40 p-1 text-xs">
						{(["24h", "7d", "30d"] as TimeWindow[]).map((w) => (
							<button
								key={w}
								type="button"
								onClick={() => setWindowSel(w)}
								className={`rounded px-3 py-1 transition ${
									w === windowSel
										? "bg-accent/20 text-accent"
										: "text-text-muted hover:text-text"
								}`}
							>
								{w}
							</button>
						))}
					</div>
					<button
						type="button"
						onClick={() => void refreshAll()}
						disabled={loading}
						className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated/40 px-3 py-1.5 text-xs hover:bg-surface-elevated disabled:opacity-50"
					>
						<Loader2 className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
						Refresh
					</button>
				</div>
			</header>

			<section className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<StatCard
					label="Requests"
					value={usage ? usage.totals.requests.toLocaleString() : "—"}
					icon={<CircleDot className="h-4 w-4" />}
					trend={windowSel}
				/>
				<StatCard
					label="Input tokens"
					value={usage ? formatTokens(usage.totals.inputTokens) : "—"}
					icon={<Coins className="h-4 w-4" />}
					trend={windowSel}
				/>
				<StatCard
					label="Output tokens"
					value={usage ? formatTokens(usage.totals.outputTokens) : "—"}
					icon={<Coins className="h-4 w-4" />}
					trend={windowSel}
				/>
				<StatCard
					label="Revenue (marked-up)"
					value={usage ? centsToDollars(usage.totals.totalCents) : "—"}
					icon={<CreditCard className="h-4 w-4" />}
					trend={`${totalMarginPct.toFixed(1)}% margin`}
				/>
			</section>

			<section className="rounded-lg border border-border bg-surface-elevated/30 p-4">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
						Model catalog & pricing
					</h2>
					<span className="text-xs text-text-muted">
						Edit input/output $/1M tokens. Live — affects every /v1/models response.
					</span>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="border-b border-border text-xs uppercase text-text-muted">
							<tr>
								<th className="py-2 text-left">Model</th>
								<th className="py-2 text-left">Provider</th>
								<th className="py-2 text-right">Input $/1M</th>
								<th className="py-2 text-right">Output $/1M</th>
								<th className="py-2 text-right">Markup</th>
								<th className="py-2"></th>
							</tr>
						</thead>
						<tbody>
							{models.map((m) => {
								const isEditing = editingId === m.id;
								return (
									<tr key={m.id} className="border-b border-border/30">
										<td className="py-2 font-medium">
											{m.displayName}
											<div className="font-mono text-[10px] text-text-muted">
												{m.id} {m.gonkaId ? `→ ${m.gonkaId}` : ""}
											</div>
										</td>
										<td className="py-2">
											<span className="rounded bg-surface-elevated px-2 py-0.5 text-xs uppercase">
												{m.provider}
											</span>
										</td>
										<td className="py-2 text-right font-mono">
											{isEditing ? (
												<input
													type="number"
													step="0.001"
													min="0"
													value={editInput}
													onChange={(e) => setEditInput(e.target.value)}
													className="w-20 rounded border border-border bg-surface-elevated px-1.5 py-1 text-right text-xs"
												/>
											) : (
												`$${m.inputPricePer1M.toFixed(4)}`
											)}
											{m.override && (
												<div className="text-[10px] text-text-muted">
													override · {timeAgo(m.override.updatedAt)}
												</div>
											)}
										</td>
										<td className="py-2 text-right font-mono">
											{isEditing ? (
												<input
													type="number"
													step="0.001"
													min="0"
													value={editOutput}
													onChange={(e) => setEditOutput(e.target.value)}
													className="w-20 rounded border border-border bg-surface-elevated px-1.5 py-1 text-right text-xs"
												/>
											) : (
												`$${m.outputPricePer1M.toFixed(4)}`
											)}
										</td>
										<td className="py-2 text-right text-text-muted">
											{m.markupPercent}%
										</td>
										<td className="py-2 text-right">
											{isEditing ? (
												<div className="flex justify-end gap-1">
													<button
														type="button"
														onClick={() => void handleEdit(m.id)}
														className="rounded bg-accent/20 px-2 py-1 text-xs text-accent hover:bg-accent/30"
													>
														Save
													</button>
													<button
														type="button"
														onClick={() => setEditingId(null)}
														className="rounded px-2 py-1 text-xs text-text-muted hover:text-text"
													>
														Cancel
													</button>
												</div>
											) : (
												<button
													type="button"
													onClick={() => startEdit(m)}
													className="text-xs text-text-muted hover:text-text"
												>
													edit
												</button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</section>

			{integrations && (
				<section className="rounded-lg border border-border bg-surface-elevated/30 p-4">
					<h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-text-muted">
						Integrations
					</h2>
					<div className="grid gap-3 md:grid-cols-3">
						<IntegrationCard
							name="Polar"
							icon={<CreditCard className="h-4 w-4" />}
							configured={integrations.polar.configured}
							notes={[
								`server: ${integrations.polar.server}`,
								integrations.polar.organizationId
									? `org: ${integrations.polar.organizationId.slice(0, 8)}…`
									: null,
								integrations.polar.note,
						 ].filter(Boolean) as string[]}
						/>
						<IntegrationCard
							name="Gonka / OpenBroker"
							icon={<ChevronRight className="h-4 w-4" />}
							configured={integrations.gonka.configured}
							health={integrations.gonka.health.status}
							notes={[
								integrations.gonka.health.latencyMs
									? `latency: ${integrations.gonka.health.latencyMs}ms`
									: null,
								integrations.gonka.health.note,
								integrations.gonka.url.replace("https://", ""),
							].filter(Boolean) as string[]}
						/>
						<IntegrationCard
							name="Venice"
							icon={<Settings2 className="h-4 w-4" />}
							configured={integrations.venice.configured}
							notes={[
								integrations.venice.private
									? "private mode enforced"
									: "non-private mode enabled",
								integrations.venice.url.replace("https://", ""),
							]}
						/>
					</div>
					<div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
						<span>
							Free chat: anon {integrations.dailyLimits.anonymous}/day · signed-in{" "}
							{integrations.dailyLimits.registered}/day
						</span>
						<span>·</span>
						<span>env: {integrations.node_env}</span>
						{health && (
							<>
								<span>·</span>
								<span>
									uptime {Math.floor(health.uptime_s / 60)}m · RAM{" "}
									{health.memory.heap_used_mb} MB · db {health.db}
								</span>
							</>
						)}
					</div>
				</section>
			)}

			{usage?.perModel && usage.perModel.length > 0 && (
				<section className="rounded-lg border border-border bg-surface-elevated/30 p-4">
					<h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-text-muted">
						Top models ({windowSel})
					</h2>
					<div className="space-y-2">
						{usage.perModel.slice(0, 8).map((m) => {
							const max = Math.max(...usage.perModel.map((x) => x.totalCents));
							const pct = max > 0 ? (m.totalCents / max) * 100 : 0;
							return (
								<div key={`${m.model}-${m.provider}`} className="text-sm">
									<div className="mb-1 flex items-center justify-between text-xs">
										<span className="font-mono">
											{m.model}{" "}
											<span className="text-text-muted">· {m.provider}</span>
										</span>
										<span>
											{m.requests.toLocaleString()} req · {formatTokens(m.inputTokens)}/
											{formatTokens(m.outputTokens)} tok · {centsToDollars(m.totalCents)}
										</span>
									</div>
									<div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
										<div
											className="h-full rounded-full bg-accent/60"
											style={{ width: `${pct}%` }}
										/>
									</div>
								</div>
							);
						})}
					</div>
				</section>
			)}

			<section className="rounded-lg border border-border bg-surface-elevated/30 p-4">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
						Recent requests
					</h2>
					<span className="text-xs text-text-muted">
						{recent.length} of last {Math.min(recent.length, 30)}
					</span>
				</div>
				{recent.length === 0 ? (
					<p className="py-6 text-center text-sm text-text-muted">
						No chat usage yet — get someone to send a message to populate this
						view.
					</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-xs">
							<thead className="border-b border-border text-text-muted">
								<tr>
									<th className="py-1.5 text-left">When</th>
									<th className="py-1.5 text-left">Model</th>
									<th className="py-1.5 text-right">Tokens</th>
									<th className="py-1.5 text-right">Cost</th>
									<th className="py-1.5 text-left">Status</th>
									<th className="py-1.5 text-left">User</th>
								</tr>
							</thead>
							<tbody>
								{recent.map((r) => (
									<tr key={r.id} className="border-b border-border/30">
										<td className="py-1.5 text-text-muted">
											{timeAgo(r.createdAt)}
										</td>
										<td className="py-1.5 font-mono">{r.model}</td>
										<td className="py-1.5 text-right font-mono">
											{r.inputTokens.toLocaleString()}/
											{r.outputTokens.toLocaleString()}
										</td>
										<td className="py-1.5 text-right font-mono">
											{centsToDollars(Number(r.totalCents))}
										</td>
										<td className="py-1.5">
											<span
												className={`rounded px-1.5 py-0.5 text-[10px] ${
													r.status === "completed" || r.status === "free_tier"
														? "bg-accent/15 text-accent"
														: "bg-error/15 text-error"
												}`}
											>
												{r.status}
											</span>
										</td>
										<td className="py-1.5 text-text-muted">
											{r.userId.slice(0, 8)}…
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
			{/* Polar Management */}
			<section className="rounded-lg border border-border bg-surface-elevated/30 p-4">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
						Polar Payments
					</h2>
					<div className="flex gap-1 text-xs">
						{(
							[
								"payments",
								"customers",
								"products",
								"subscriptions",
								"checkouts",
							] as PolarTab[]
						).map((tab) => (
							<button
								key={tab}
								type="button"
								onClick={() => {
									setPolarTab(tab);
									setPolarError(null);
								}}
								className={`rounded px-2 py-1 transition ${
									polarTab === tab
										? "bg-accent/20 text-accent"
										: "text-text-muted hover:text-text"
								}`}
							>
								{tab}
							</button>
						))}
					</div>
				</div>
				{polarError && (
					<div className="mb-3 rounded-md bg-error/10 p-2 text-xs text-error">
						{polarError}
					</div>
				)}
				{polarLoading ? (
					<div className="flex items-center gap-2 text-text-muted">
						<Loader2 className="h-4 w-4 animate-spin" /> Loading…
					</div>
				) : polarTab === "payments" ? (
					polarPayments.length === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">
							No payments yet. Click Refresh to load data.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead className="border-b border-border text-text-muted">
									<tr>
										<th className="py-1.5 text-left">ID</th>
										<th className="py-1.5 text-right">Amount</th>
										<th className="py-1.5 text-left">Status</th>
										<th className="py-1.5 text-left">Customer</th>
									</tr>
								</thead>
								<tbody>
									{polarPayments.map((p) => (
										<tr
											key={p.id}
											className="border-b border-border/30"
										>
											<td className="py-1.5 font-mono">
												{p.id.slice(0, 12)}…
											</td>
											<td className="py-1.5 text-right font-mono">
												{(p.amount / 100).toFixed(2)}{" "}
												{p.currency.toUpperCase()}
											</td>
											<td className="py-1.5">
												<span
													className={`rounded px-1.5 py-0.5 text-[10px] ${
														p.status === "paid" || p.status === "completed"
															? "bg-accent/15 text-accent"
															: "bg-warning/15 text-warning"
													}`}
												>
													{p.status}
												</span>
											</td>
											<td className="py-1.5 text-text-muted">
												{p.customer_email}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)
				) : polarTab === "customers" ? (
					polarCustomers.length === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">
							No customers yet. Click Refresh to load data.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead className="border-b border-border text-text-muted">
									<tr>
										<th className="py-1.5 text-left">ID</th>
										<th className="py-1.5 text-left">Name</th>
										<th className="py-1.5 text-left">Email</th>
									</tr>
								</thead>
								<tbody>
									{polarCustomers.map((c) => (
										<tr
											key={c.id}
											className="border-b border-border/30"
										>
											<td className="py-1.5 font-mono">
												{c.id.slice(0, 12)}…
											</td>
											<td className="py-1.5">{c.name || "—"}</td>
											<td className="py-1.5 text-text-muted">
												{c.email}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)
				) : polarTab === "products" ? (
					polarProducts.length === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">
							No products yet. Click Refresh to load data.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead className="border-b border-border text-text-muted">
									<tr>
										<th className="py-1.5 text-left">ID</th>
										<th className="py-1.5 text-left">Name</th>
										<th className="py-1.5 text-left">Type</th>
										<th className="py-1.5 text-right">Price</th>
									</tr>
								</thead>
								<tbody>
									{polarProducts.map((p) => (
										<tr
											key={p.id}
											className="border-b border-border/30"
										>
											<td className="py-1.5 font-mono">
												{p.id.slice(0, 12)}…
											</td>
											<td className="py-1.5">{p.name}</td>
											<td className="py-1.5">
												<span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] uppercase">
													{p.type}
												</span>
											</td>
											<td className="py-1.5 text-right font-mono">
												{p.pricing?.amount !== undefined
													? `${(p.pricing.amount / 100).toFixed(2)} ${p.pricing.currency?.toUpperCase() ?? "USD"}`
													: "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)
				) : polarTab === "subscriptions" ? (
					polarSubscriptions.length === 0 ? (
						<p className="py-4 text-center text-sm text-text-muted">
							No subscriptions yet. Click Refresh to load data.
						</p>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-xs">
								<thead className="border-b border-border text-text-muted">
									<tr>
										<th className="py-1.5 text-left">ID</th>
										<th className="py-1.5 text-left">Customer</th>
										<th className="py-1.5 text-left">Product</th>
										<th className="py-1.5 text-left">Status</th>
									</tr>
								</thead>
								<tbody>
									{polarSubscriptions.map((s) => (
										<tr
											key={s.id}
											className="border-b border-border/30"
										>
											<td className="py-1.5 font-mono">
												{s.id.slice(0, 12)}…
											</td>
											<td className="py-1.5 font-mono text-text-muted">
												{s.customer_id.slice(0, 12)}…
											</td>
											<td className="py-1.5 font-mono text-text-muted">
												{s.product_id.slice(0, 12)}…
											</td>
											<td className="py-1.5">
												<span
													className={`rounded px-1.5 py-0.5 text-[10px] ${
														s.status === "active"
															? "bg-accent/15 text-accent"
															: "bg-text-muted/15 text-text-muted"
													}`}
												>
													{s.status}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)
				) : polarTab === "checkouts" ? (
					<div className="space-y-4">
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<label className="mb-1 block text-xs text-text-muted">
									Product ID
								</label>
								<input
									type="text"
									value={checkoutProduct}
									onChange={(e) => setCheckoutProduct(e.target.value)}
									placeholder="prod_xxx"
									className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs text-text-muted">
									Customer Email
								</label>
								<input
									type="email"
									value={checkoutEmail}
									onChange={(e) => setCheckoutEmail(e.target.value)}
									placeholder="user@example.com"
									className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs text-text-muted">
									Customer Name (optional)
								</label>
								<input
									type="text"
									value={checkoutName}
									onChange={(e) => setCheckoutName(e.target.value)}
									placeholder="John Doe"
									className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs text-text-muted">
									Success URL (optional)
								</label>
								<input
									type="url"
									value={checkoutSuccess}
									onChange={(e) => setCheckoutSuccess(e.target.value)}
									placeholder="https://example.com/success"
									className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
								/>
							</div>
						</div>
						<div>
							<label className="mb-1 block text-xs text-text-muted">
								Cancel URL (optional)
							</label>
							<input
								type="url"
								value={checkoutCancel}
								onChange={(e) => setCheckoutCancel(e.target.value)}
								placeholder="https://example.com/cancel"
								className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
							/>
						</div>
						<button
							type="button"
							onClick={async () => {
								setPolarError(null);
								setPolarLoading(true);
								try {
									const result = await polarFetch<{
										data: PolarCheckout;
									}>(`/v1/admin/polar/checkouts`);
									setCheckoutResult(result.data);
								} catch (err) {
									setPolarError(String((err as Error).message ?? err));
								} finally {
									setPolarLoading(false);
								}
							}}
							disabled={polarLoading || !checkoutProduct}
							className="rounded-md bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-50"
						>
							{polarLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Create Checkout Link"
							)}
						</button>
						{checkoutResult && (
							<div className="rounded-md border border-border bg-surface-elevated/50 p-3">
								<p className="text-xs text-text-muted mb-2">
									Checkout created — share this link:
								</p>
								<a
									href={checkoutResult.checkout_url}
									target="_blank"
									rel="noopener noreferrer"
									className="break-all text-sm font-mono text-accent hover:underline"
								>
									{checkoutResult.checkout_url}
								</a>
							</div>
						)}
					</div>
				) : null}
				{polarTab !== "checkouts" && (polarPayments.length > 0 || polarCustomers.length > 0 || polarProducts.length > 0 || polarSubscriptions.length > 0) && (
					<div className="mt-3 flex justify-end">
						<button
							type="button"
							onClick={async () => {
								setPolarError(null);
								setPolarLoading(true);
								try {
									if (polarTab === "payments") {
										const data = await polarFetch<{ data: PolarPayment[] }>("/v1/admin/polar/payments");
										setPolarPayments(data.data);
									} else if (polarTab === "customers") {
										const data = await polarFetch<{ data: PolarCustomer[] }>("/v1/admin/polar/customers");
										setPolarCustomers(data.data);
									} else if (polarTab === "products") {
										const data = await polarFetch<{ data: PolarProduct[] }>("/v1/admin/polar/products");
										setPolarProducts(data.data);
									} else if (polarTab === "subscriptions") {
										const data = await polarFetch<{ data: PolarSubscription[] }>("/v1/admin/polar/subscriptions");
										setPolarSubscriptions(data.data);
									}
								} catch (err) {
									setPolarError(String((err as Error).message ?? err));
								} finally {
									setPolarLoading(false);
								}
							}}
							disabled={polarLoading}
							className="rounded-md border border-border bg-surface-elevated/40 px-3 py-1.5 text-xs hover:bg-surface-elevated disabled:opacity-50"
						>
							{polarLoading ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								"Refresh"
							)}
						</button>
					</div>
				)}
			</section>
		</div>
	);
}

function StatCard({
	label,
	value,
	icon,
	trend,
}: {
	label: string;
	value: string;
	icon: React.ReactNode;
	trend?: string;
}) {
	return (
		<div className="rounded-lg border border-border bg-surface-elevated/30 p-4">
			<div className="mb-1 flex items-center justify-between text-xs text-text-muted">
				<span className="flex items-center gap-1.5 uppercase tracking-wide">
					{icon}
					{label}
				</span>
				{trend && <span className="font-mono">{trend}</span>}
			</div>
			<div className="text-2xl font-semibold">{value}</div>
		</div>
	);
}

function IntegrationCard({
	name,
	icon,
	configured,
	health,
	notes,
}: {
	name: string;
	icon: React.ReactNode;
	configured: boolean;
	health?: "healthy" | "degraded" | "down";
	notes: string[];
}) {
	return (
		<div className="rounded-md border border-border bg-surface-elevated/30 p-3">
			<div className="mb-1.5 flex items-center justify-between">
				<span className="flex items-center gap-1.5 text-sm font-medium">
					{icon}
					{name}
				</span>
				{configured ? (
					health ? (
						<span
							className={`flex items-center gap-1 text-xs ${
								health === "healthy"
									? "text-accent"
									: health === "degraded"
										? "text-warning"
										: "text-error"
							}`}
						>
							{health === "healthy" ? (
								<CheckCircle2 className="h-3 w-3" />
							) : (
								<XCircle className="h-3 w-3" />
							)}
							{health}
						</span>
					) : (
						<span className="flex items-center gap-1 text-xs text-accent">
							<CheckCircle2 className="h-3 w-3" /> configured
						</span>
					)
				) : (
					<span className="flex items-center gap-1 text-xs text-text-muted">
						<AlertTriangle className="h-3 w-3" /> not configured
					</span>
				)}
			</div>
			<ul className="space-y-0.5 text-xs text-text-muted">
				{notes.map((n, i) => (
					<li key={i} className="flex items-start gap-1">
						<ArrowUpRight className="mt-0.5 h-2.5 w-2.5 flex-none text-text-muted/50" />
						<span>{n}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
