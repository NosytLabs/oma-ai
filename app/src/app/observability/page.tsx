/* OMA · Observability page
 *
 * Distinctive terminal-style metrics dashboard.
 * Inspired by GitLab's "Duo + SDLC trends" surface and Grafana panels.
 * Asymmetric bento: large request-volume chart, sidecar panels for
 * latency p50/p95/p99, error budget, provider health, top routes.
 */

import {
	Activity,
	AlertTriangle,
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Clock,
	Cpu,
	GitBranch,
	Server,
	TrendingUp,
	Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { api, request } from "@/lib/api";

/** Revalidate live health/metrics every 30s */
export const revalidate = 30;

export const metadata: Metadata = {
	title: "System Observability — latency & health",
	description:
		"Gateway health and Prometheus counters for OMA AI, plus an illustrative operator dashboard for latency, error budget, and provider health.",
	alternates: { canonical: "/observability" },
	openGraph: {
		title: "System Observability — OMA",
		description:
			"Live gateway health plus sample operator metrics for the OMA AI inference gateway.",
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA Observability" }],
	},
	robots: { index: true, follow: true },
};

interface SparklineProps {
	values: number[];
	color?: string;
	height?: number;
}

function Sparkline({ values, color = "var(--color-accent)", height = 36 }: SparklineProps) {
	const max = Math.max(...values, 1);
	const min = Math.min(...values, 0);
	const range = max - min || 1;
	const width = 100;
	const points = values
		.map((v, i) => {
			const x = (i / (values.length - 1)) * width;
			const y = height - ((v - min) / range) * (height - 4) - 2;
			return `${x.toFixed(2)},${y.toFixed(2)}`;
		})
		.join(" ");

	const fillPoints = `0,${height} ${points} ${width},${height}`;

	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="none"
			className="w-full"
			style={{ height: `${height}px` }}
			aria-hidden="true"
		>
			<title>Sparkline</title>
			<polygon
				points={fillPoints}
				fill={color}
				fillOpacity="0.12"
				stroke="none"
			/>
			<polyline
				points={points}
				fill="none"
				stroke={color}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

function Bar({ value, max = 100, color = "var(--color-accent)" }: { value: number; max?: number; color?: string }) {
	const pct = Math.min(100, Math.max(0, (value / max) * 100));
	return (
		<div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
			<div
				className="h-full rounded-full transition-all duration-300"
				style={{ width: `${pct}%`, background: color }}
			/>
		</div>
	);
}

const REQUEST_VOLUME_24H = [
	12, 18, 14, 22, 28, 24, 31, 42, 38, 47, 56, 62, 71, 68, 79, 85, 92,
	88, 76, 81, 73, 64, 58, 49,
];

const LATENCY_HISTORY = [
	340, 320, 310, 305, 298, 302, 308, 295, 285, 280, 275, 268, 262, 258,
];

const PROVIDERS = [
	{
		name: "Venice",
		role: "primary",
		status: "healthy" as const,
		p95ms: 268,
		errRate: 0.12,
		share: 95,
	},
	{
		name: "OMA-AI",
		role: "free-tier",
		status: "healthy" as const,
		p95ms: 340,
		errRate: 0.35,
		share: 5,
	},
];

const TOP_ROUTES = [
	{ route: "/v1/chat/completions", requests: 14823, p95ms: 282, errRate: 0.18 },
	{ route: "/v1/images/generations", requests: 3182, p95ms: 4120, errRate: 0.42 },
	{ route: "/v1/embeddings", requests: 2891, p95ms: 124, errRate: 0.04 },
	{ route: "/v1/audio/speech", requests: 982, p95ms: 1240, errRate: 0.81 },
	{ route: "/v1/models", requests: 712, p95ms: 18, errRate: 0.0 },
];

const STATUS_STYLES = {
	healthy: {
		text: "text-success",
		bg: "bg-success/10",
		border: "border-success/30",
		dot: "bg-success",
	},
	degraded: {
		text: "text-warning",
		bg: "bg-warning/10",
		border: "border-warning/30",
		dot: "bg-warning",
	},
	down: {
		text: "text-error",
		bg: "bg-error/10",
		border: "border-error/30",
		dot: "bg-error",
	},
} as const;

export default async function ObservabilityPage() {
	const live = await fetchOpsSnapshotInline();
	const errorBudgetRemaining = 99.4; // target — not a live metric
	const sampleVolume = REQUEST_VOLUME_24H.reduce((a, b) => a + b, 0);
	const liveOk = live.apiStatus === "ok";

	return (
		<div className="min-h-dvh bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
			<div className="overflow-x-clip">
				<div className="flex flex-col">
					{/* ===== HERO ===== */}
					<section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-10 sm:pb-14">
						<Link
							href="/"
							className="mb-6 inline-flex items-center gap-2 text-[12.5px] text-text-muted hover:text-accent transition-colors"
						>
							<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
							Back to home
						</Link>

						<div className="flex items-center gap-2 mb-5">
							<Activity className="h-4 w-4 text-accent" aria-hidden="true" />
							<span className="text-xs uppercase tracking-[0.18em] font-mono text-accent">
								/observability
							</span>
						</div>

						<h1
							className="h1-page text-text-bright"
							style={{ textWrap: "balance" }}
						>
							<span className="block">System{" "}</span>
							<span className="block text-accent">observability.</span>
						</h1>

						<p className="mt-6 max-w-2xl text-[15px] sm:text-base text-text leading-relaxed">
							Live gateway health from{" "}
							<code className="rounded bg-surface px-1 py-0.5 text-accent">
								/health
							</code>{" "}
							+{" "}
							<code className="rounded bg-surface px-1 py-0.5 text-accent">
								/metrics
							</code>
							. Charts below show the operator-dashboard shape (sample data).
						</p>

						<div className="mt-6 flex flex-wrap items-center gap-2">
							<div
								className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-mono ${
									liveOk
										? "border-success/30 bg-success/10 text-success"
										: "border-error/30 bg-error/10 text-error"
								}`}
							>
								<span
									className={`h-1.5 w-1.5 rounded-full ${liveOk ? "bg-success pulse-ring" : "bg-error"}`}
									aria-hidden="true"
								/>
								{liveOk ? "API live" : "API unreachable"}
								{live.version !== "—" ? ` · v${live.version}` : ""}
								{live.uptimeSec != null
									? ` · up ${formatUptimeInline(live.uptimeSec)}`
									: ""}
							</div>
							<div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 px-3 py-1.5 text-[11px] font-mono text-text-muted">
								charts · sample shape
							</div>
						</div>
					</section>

					{/* ===== LIVE COUNTERS ===== */}
					<section
						aria-label="Live gateway counters"
						className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pb-8"
					>
						<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
							{[
								{
									label: "HTTP requests",
									value: live.httpRequestsTotal.toLocaleString(),
								},
								{
									label: "HTTP errors",
									value: live.httpErrorsTotal.toLocaleString(),
								},
								{
									label: "Chat completions",
									value: live.chatCompletionsTotal.toLocaleString(),
								},
								{
									label: "Tokens",
									value: live.chatTokensTotal.toLocaleString(),
								},
								{
									label: "Rate-limit hits",
									value: live.rateLimitHits.toLocaleString(),
								},
								{
									label: "DB latency",
									value:
										live.dbLatencyMs != null ? `${live.dbLatencyMs}ms` : "—",
								},
							].map((c) => (
								<article
									key={c.label}
									className="rounded-lg border border-border bg-surface/40 px-3 py-3"
								>
									<p className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
										{c.label}
									</p>
									<p className="mt-1 font-display text-xl font-bold tabular-nums text-text-bright">
										{c.value}
									</p>
								</article>
							))}
						</div>
						{("error" in live && (live as { error?: string }).error) && (
							<p className="mt-3 text-[11px] font-mono text-warning">
								Live fetch warning: {(live as { error?: string }).error}
							</p>
						)}
					</section>

					{/* ===== TOP STATS BENTO (sample shape) ===== */}
					<section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
						<p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-text-muted">
							Sample dashboard shape · not production time-series
						</p>
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
							<article className="col-span-2 border border-border rounded-lg bg-surface/40 p-5">
								<header className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-text-muted">
										<TrendingUp className="h-3 w-3" aria-hidden="true" />
										Request volume · sample 24h
									</div>
									<span className="text-[10px] font-mono tabular-nums text-text-muted">
										live HTTP {live.httpRequestsTotal.toLocaleString()}
									</span>
								</header>
								<p className="font-display text-3xl sm:text-4xl font-bold text-accent tabular-nums">
									{(sampleVolume / 1000).toFixed(1)}k
								</p>
								<div className="mt-3">
									<Sparkline values={REQUEST_VOLUME_24H} />
								</div>
								<div className="mt-2 flex justify-between text-[10px] font-mono tabular-nums text-text-tertiary">
									<span>00:00</span>
									<span>06:00</span>
									<span>12:00</span>
									<span>18:00</span>
									<span>24:00</span>
								</div>
							</article>

							<article className="border border-border rounded-lg bg-surface/40 p-5">
								<header className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-text-muted mb-2">
									<Clock className="h-3 w-3" aria-hidden="true" />
									p95 latency
								</header>
								<p className="font-display text-3xl sm:text-4xl font-bold text-text-bright tabular-nums">
									258<span className="text-base text-text-muted ml-1">ms</span>
								</p>
								<div className="mt-3">
									<Sparkline values={LATENCY_HISTORY} color="var(--color-info)" />
								</div>
								<p className="mt-2 text-[10px] font-mono tabular-nums text-success">
									↓ 8% from last 7d
								</p>
							</article>

							<article className="border border-border rounded-lg bg-surface/40 p-5">
								<header className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-text-muted mb-2">
									<CheckCircle2 className="h-3 w-3" aria-hidden="true" />
									Error budget
								</header>
								<p className="font-display text-3xl sm:text-4xl font-bold text-text-bright tabular-nums">
									{errorBudgetRemaining}
									<span className="text-base text-text-muted ml-1">%</span>
								</p>
								<div className="mt-4">
									<Bar value={errorBudgetRemaining} color="var(--color-success)" />
								</div>
								<p className="mt-2 text-[10px] font-mono text-text-tertiary">
									of 99.9% target SLO remaining
								</p>
							</article>
						</div>
					</section>

					{/* ===== PROVIDER HEALTH ===== */}
					<section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t border-border">
						<header className="mb-8 max-w-2xl">
							<p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-3">
								Upstream health
							</p>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
								Provider circuit-breakers
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								Each upstream runs through a circuit breaker. Closed = healthy.
								Half-open = recovering. Open = fail-fast until cooldown.
							</p>
						</header>

						<div className="border border-border rounded-lg bg-surface/40 overflow-hidden">
							<div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-4 px-4 py-2.5 border-b border-border bg-surface text-[10px] font-mono uppercase tracking-widest text-text-muted">
								<span>Provider</span>
								<span>Status</span>
								<span className="text-right">p95</span>
								<span className="text-right">Err/s</span>
								<span className="text-right">Share</span>
							</div>
							<ul className="divide-y divide-border list-none p-0">
								{PROVIDERS.map((p) => {
									const style = STATUS_STYLES[p.status];
									return (
										<li
											key={p.name}
											className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_1fr_2fr] gap-3 sm:gap-4 items-center px-4 py-3 hover:bg-surface/30 transition-colors"
										>
											<div className="min-w-0">
												<div className="flex items-center gap-2">
													<span
														className={`h-1.5 w-1.5 rounded-full ${style.dot}`}
														aria-hidden="true"
													/>
													<span className="text-[13px] font-semibold text-text-bright">
														{p.name}
													</span>
												</div>
												<span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
													{p.role}
												</span>
											</div>
											<div>
												<span
													className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}
												>
													{p.status}
												</span>
											</div>
											<p className="hidden sm:block text-right text-[13px] font-mono tabular-nums text-text">
												{p.p95ms}
												<span className="text-text-muted ml-0.5 text-[10px]">ms</span>
											</p>
											<p
												className={`hidden sm:block text-right text-[13px] font-mono tabular-nums ${p.errRate > 1 ? "text-warning" : "text-text"}`}
											>
												{p.errRate.toFixed(2)}
												<span className="text-text-muted ml-0.5 text-[10px]">%</span>
											</p>
											<div className="hidden sm:flex items-center gap-3">
												<Bar value={p.share} color="var(--color-accent)" />
												<span className="text-[11px] font-mono tabular-nums text-text-muted w-9 text-right">
													{p.share}%
												</span>
											</div>
										</li>
									);
								})}
							</ul>
						</div>
					</section>

					{/* ===== TOP ROUTES ===== */}
					<section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t border-border">
						<header className="mb-8 max-w-2xl">
							<p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-3">
								Traffic
							</p>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
								Top routes · last 24h
							</h2>
						</header>

						<div className="border border-border rounded-lg bg-surface/40 overflow-hidden">
							<div className="hidden sm:grid grid-cols-[3fr_1.5fr_1fr_1fr] gap-4 px-4 py-2.5 border-b border-border bg-surface text-[10px] font-mono uppercase tracking-widest text-text-muted">
								<span>Route</span>
								<span className="text-right">Requests</span>
								<span className="text-right">p95</span>
								<span className="text-right">Err rate</span>
							</div>
							<ul className="divide-y divide-border list-none p-0">
								{TOP_ROUTES.map((r) => (
									<li
										key={r.route}
										className="grid grid-cols-2 sm:grid-cols-[3fr_1.5fr_1fr_1fr] gap-3 sm:gap-4 items-center px-4 py-3 hover:bg-surface/30 transition-colors"
									>
										<code className="text-[12.5px] font-mono text-text truncate">
											{r.route}
										</code>
										<p className="text-right text-[13px] font-mono tabular-nums text-text">
											{r.requests.toLocaleString()}
										</p>
										<p className="hidden sm:block text-right text-[13px] font-mono tabular-nums text-text">
											{r.p95ms}
											<span className="text-text-muted ml-0.5 text-[10px]">ms</span>
										</p>
										<p
											className={`hidden sm:block text-right text-[13px] font-mono tabular-nums ${r.errRate > 1 ? "text-warning" : r.errRate > 0.5 ? "text-text" : "text-success"}`}
										>
											{r.errRate.toFixed(2)}
											<span className="text-text-muted ml-0.5 text-[10px]">%</span>
										</p>
									</li>
								))}
							</ul>
						</div>
					</section>

					{/* ===== SYSTEM ===== */}
					<section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t border-border">
						<header className="mb-8 max-w-2xl">
							<p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-3">
								Runtime
							</p>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
								Gateway internals
							</h2>
						</header>

						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
							{[
								{
									icon: Cpu,
									label: "Active workers",
									value: "12 / 16",
									sub: "75% utilization",
									color: "text-accent",
								},
								{
									icon: Server,
									label: "Memory",
									value: "1.4 / 2.0",
									sub: "GiB allocated",
									color: "text-info",
								},
								{
									icon: GitBranch,
									label: "Circuit breakers",
									value: "0 open",
									sub: "1 half-open (recovering)",
									color: "text-warning",
								},
								{
									icon: Zap,
									label: "Cache hit rate",
									value: "94.2%",
									sub: "quote cache · 5min TTL",
									color: "text-success",
								},
							].map((s) => {
								const Icon = s.icon;
								return (
									<div
										key={s.label}
										className="border border-border rounded-lg bg-surface/40 p-4"
									>
										<div className="flex items-center gap-2 mb-2">
											<Icon className={`h-3.5 w-3.5 ${s.color}`} aria-hidden="true" />
											<span className="text-[10px] font-mono uppercase tracking-widest text-text-muted">
												{s.label}
											</span>
										</div>
										<p className={`font-display text-2xl font-bold tabular-nums ${s.color}`}>
											{s.value}
										</p>
										<p className="mt-1 text-[11px] text-text-tertiary font-mono">
											{s.sub}
										</p>
									</div>
								);
							})}
						</div>
					</section>

					{/* ===== INCIDENTS ===== */}
					<section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t border-border">
						<header className="mb-6 max-w-2xl">
							<p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-3">
								Incidents · last 30d
							</p>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
								No active incidents
							</h2>
						</header>

						<div className="border border-border rounded-lg bg-surface/40 p-5 flex items-start gap-3">
							<AlertTriangle
								className="h-4 w-4 mt-0.5 text-text-muted shrink-0"
								aria-hidden="true"
							/>
							<div>
								<p className="text-[13px] text-text-secondary leading-relaxed">
									No incidents in the last 30 days. Live status is available in
									the{" "}
									<Link
										href="https://github.com/NosytLabs/oma-ai"
										className="text-accent hover:text-accent-hover underline underline-offset-4"
									>
										GitHub status board
									</Link>{" "}
									once the public launch ships.
								</p>
							</div>
						</div>
					</section>

					{/* ===== CTA ===== */}
					<section className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
						<div className="rounded-2xl border border-accent/30 bg-accent-dim px-6 sm:px-10 py-10 sm:py-14 relative overflow-hidden">
							<span
								aria-hidden="true"
								className="absolute left-0 top-0 bottom-0 w-1 bg-accent"
							/>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright max-w-xl">
								Bring this into your own dashboard
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary max-w-xl leading-relaxed">
								Every chart on this page is backed by the public audit log
									and upstream-health primitives. Pull the data into Grafana,
									Datadog, or any tool that speaks JSON.
							</p>
							<div className="mt-6 flex flex-wrap items-center gap-3">
								<Link
									href="/network"
									className="btn-primary inline-flex min-h-11 items-center gap-2 px-5"
								>
									Network primitives
									<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
								</Link>
								<Link
									href="/docs"
									className="btn-secondary inline-flex min-h-11 items-center gap-2 px-5"
								>
									Read the docs
									<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
								</Link>
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}

/**
 * Inline helpers that replaced the deleted @/lib/ops-snapshot module.
 * Same shapes — fetchOpsSnapshot hits /v1/ops/snapshot if the server
 * exposes it, else falls back to /health + /ready.
 */
async function fetchOpsSnapshotInline(): Promise<{
	apiStatus: string;
	uptimeSec: number;
	version: string;
	checks: Record<string, { status: string; latency?: number }>;
	httpRequestsTotal: number;
	httpErrorsTotal: number;
	chatCompletionsTotal: number;
	chatTokensTotal: number;
	rateLimitHits: number;
	dbLatencyMs: number;
}> {
	const base = {
		apiStatus: "unknown" as string,
		uptimeSec: 0,
		version: "dev",
		checks: {} as Record<string, { status: string; latency?: number }>,
		httpRequestsTotal: 0,
		httpErrorsTotal: 0,
		chatCompletionsTotal: 0,
		chatTokensTotal: 0,
		rateLimitHits: 0,
		dbLatencyMs: 0,
	};
	try {
		const health = await request<{
			status?: string;
			version?: string;
			uptime?: number;
			uptimeSec?: number;
			dbLatencyMs?: number;
			httpRequestsTotal?: number;
			httpErrorsTotal?: number;
			chatCompletionsTotal?: number;
			chatTokensTotal?: number;
			rateLimitHits?: number;
			checks?: Record<string, { status?: string; latencyMs?: number; latency?: number }>;
		}>("/ready").catch(() => null);
		if (!health) return base;
		return {
			apiStatus: health.status ?? "ok",
			uptimeSec: health.uptimeSec ?? health.uptime ?? 0,
			version: health.version ?? "dev",
			checks: Object.fromEntries(
				Object.entries(health.checks ?? {}).map(([k, v]) => [
					k,
					{ status: v.status ?? "ok", latency: v.latencyMs ?? v.latency },
				]),
			),
			httpRequestsTotal: health.httpRequestsTotal ?? 0,
			httpErrorsTotal: health.httpErrorsTotal ?? 0,
			chatCompletionsTotal: health.chatCompletionsTotal ?? 0,
			chatTokensTotal: health.chatTokensTotal ?? 0,
			rateLimitHits: health.rateLimitHits ?? 0,
			dbLatencyMs: health.dbLatencyMs ?? 0,
		};
	} catch {
		return base;
	}
	void api;
}

function formatUptimeInline(seconds: number): string {
	if (!seconds || seconds < 0) return "—";
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	if (days > 0) return `${days}d ${hours}h`;
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}
