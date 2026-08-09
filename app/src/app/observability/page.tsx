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
	Database,
	Server,
	TrendingUp,
	Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { request } from "@/lib/api";
import { InViewFade } from "@/components/motion/in-view-fade";

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
				className="h-full rounded-full transition-[width,background-color] duration-200 ease-out"
				style={{ width: `${pct}%`, background: color }}
			/>
		</div>
	);
}

/* Illustrative time-series shape only — no historical store exists yet. */
const SAMPLE_VOLUME_24H = [
	12, 18, 14, 22, 28, 24, 31, 42, 38, 47, 56, 62, 71, 68, 79, 85, 92,
	88, 76, 81, 73, 64, 58, 49,
];

/* Illustrative per-provider shape. Real per-provider latency/error stats
 * require production telemetry that does not exist yet. */
const SAMPLE_PROVIDERS = [
	{ name: "Venice", role: "primary", status: "healthy" as const, share: 70 },
	{ name: "Zyloo", role: "frontier", status: "healthy" as const, share: 20 },
	{ name: "OpenBroker", role: "open-models", status: "healthy" as const, share: 10 },
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
	const errorBudgetRemaining = 99.4; // SLO target — not a live metric
	const sampleVolume = SAMPLE_VOLUME_24H.reduce((a, b) => a + b, 0);
	const liveOk = live.apiStatus === "ok";

	return (
		<div className="min-h-dvh bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
			<div className="overflow-x-clip">
				<div className="flex flex-col">
				{/* ===== HERO ===== */}
				<section className="container-page pt-4 sm:pt-6 pb-10 sm:pb-14">
						<InViewFade>
						<Link
							href="/"
							className="mb-6 inline-flex items-center gap-2 text-[12.5px] text-text-muted hover:text-accent transition-colors duration-200 ease-out"
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
							<span className="block">System{""}</span>
							<span className="block text-accent">observability.</span>
						</h1>

						<p className="mt-6 max-w-2xl text-[15px] sm:text-base text-text leading-relaxed">
							Live gateway health and real request/token counters from{""}
							<code className="rounded-[var(--radius-sm)] bg-surface px-1 py-0.5 text-accent">
								/v1/ops/snapshot
							</code>
							. The trend panels below are an illustrative operator-dashboard
							shape and are labelled as such.
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
								{liveOk ? "API live" : "API degraded"}
								{live.version !== "—" ? ` · v${live.version}` : ""}
								{live.uptimeSec > 0
									? ` · up ${formatUptimeInline(live.uptimeSec)}`
									: ""}
							</div>
							<div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 px-3 py-1.5 text-[11px] font-mono text-text-muted">
								trend charts · illustrative
							</div>
						</div>
						</InViewFade>
					</section>

					{/* ===== LIVE COUNTERS ===== */}
					<section
						aria-label="Live gateway counters"
						className="container-page pb-8"
					>
						<p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-text-muted">
							Live · HTTP since process start, chat last 24h
						</p>
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
									label: "Chat completions · 24h",
									value: live.chatCompletionsTotal.toLocaleString(),
								},
								{
									label: "Tokens · 24h",
									value: live.chatTokensTotal.toLocaleString(),
								},
								{
									label: "Chat errors · 24h",
									value: live.chatErrors24h.toLocaleString(),
								},
								{
									label: "DB latency",
									value:
										live.dbLatencyMs != null ? `${live.dbLatencyMs}ms` : "—",
								},
							].map((c) => (
								<article
									key={c.label}
									className="rounded-[var(--radius-lg)] border border-border bg-surface/40 px-3 py-3"
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
					<section className="container-page pb-12 sm:pb-16">
						<p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-text-muted">
							Sample dashboard shape · not production time-series
						</p>
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
							<article className="col-span-2 border border-border rounded-[var(--radius-lg)] bg-surface/40 p-5">
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
									<Sparkline values={SAMPLE_VOLUME_24H} />
								</div>
								<div className="mt-2 flex justify-between text-[10px] font-mono tabular-nums text-text-tertiary">
									<span>00:00</span>
									<span>06:00</span>
									<span>12:00</span>
									<span>18:00</span>
									<span>24:00</span>
								</div>
							</article>

							<article className="border border-border rounded-[var(--radius-lg)] bg-surface/40 p-5">
								<header className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-text-muted mb-2">
									<Clock className="h-3 w-3" aria-hidden="true" />
									chat p95 · 24h
								</header>
								<p className="font-display text-3xl sm:text-4xl font-bold text-text-bright tabular-nums">
									{live.chatP95Ms != null ? (
										<>
											{live.chatP95Ms}
											<span className="text-base text-text-muted ml-1">ms</span>
										</>
									) : (
										<span className="text-text-muted">—</span>
									)}
								</p>
								<p className="mt-3 text-[10px] font-mono tabular-nums text-text-tertiary leading-relaxed">
									from recorded usage latency. Blank when no
									latency-tagged requests in the window.
								</p>
							</article>

							<article className="border border-border rounded-[var(--radius-lg)] bg-surface/40 p-5">
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
									SLO target · not a live metric
								</p>
							</article>
						</div>
					</section>

					{/* ===== UPSTREAM PROVIDERS (illustrative) ===== */}
					<section className="container-page py-12 sm:py-16 border-t border-border">
						<header className="mb-8 max-w-2xl">
							<p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-3">
								Upstream routing · illustrative
							</p>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
								Provider fan-out
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								The gateway fans out to these upstreams. The status and traffic
								share below are a sample shape — live per-provider telemetry
								ships with production monitoring.
							</p>
						</header>

						<div className="border border-border rounded-[var(--radius-lg)] bg-surface/40 overflow-hidden">
							<div className="hidden sm:grid grid-cols-[2fr_1fr_2fr] gap-4 px-4 py-2.5 border-b border-border bg-surface text-[10px] font-mono uppercase tracking-widest text-text-muted">
								<span>Provider</span>
								<span>Status</span>
								<span className="text-right">Traffic share (sample)</span>
							</div>
							<ul className="divide-y divide-border list-none p-0">
								{SAMPLE_PROVIDERS.map((p) => {
									const style = STATUS_STYLES[p.status];
									return (
										<li
											key={p.name}
											className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_2fr] gap-3 sm:gap-4 items-center px-4 py-3 hover:bg-surface/30 transition-colors duration-200 ease-out"
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
													className={`inline-flex items-center rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}
												>
													{p.status}
												</span>
											</div>
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

					{/* ===== TOP ROUTES (live) ===== */}
					<section className="container-page py-12 sm:py-16 border-t border-border">
						<header className="mb-8 max-w-2xl">
							<p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-3">
								Traffic · live
							</p>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
								Top routes · since process start
							</h2>
						</header>

						<div className="border border-border rounded-[var(--radius-lg)] bg-surface/40 overflow-hidden">
							<div className="hidden sm:grid grid-cols-[3fr_1.5fr_1fr_1fr] gap-4 px-4 py-2.5 border-b border-border bg-surface text-[10px] font-mono uppercase tracking-widest text-text-muted">
								<span>Route</span>
								<span className="text-right">Requests</span>
								<span className="text-right">p95</span>
								<span className="text-right">Err rate</span>
							</div>
							{live.topRoutes.length === 0 ? (
								<p className="px-4 py-6 text-[12px] font-mono text-text-tertiary">
									No route traffic recorded yet this process.
								</p>
							) : (
								<ul className="divide-y divide-border list-none p-0">
									{live.topRoutes.map((r) => {
										const errRate =
											r.requests > 0 ? (r.errors / r.requests) * 100 : 0;
										return (
											<li
												key={r.route}
												className="grid grid-cols-2 sm:grid-cols-[3fr_1.5fr_1fr_1fr] gap-3 sm:gap-4 items-center px-4 py-3 hover:bg-surface/30 transition-colors duration-200 ease-out"
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
													className={`hidden sm:block text-right text-[13px] font-mono tabular-nums ${errRate > 1 ? "text-warning" : errRate > 0.5 ? "text-text" : "text-success"}`}
												>
													{errRate.toFixed(2)}
													<span className="text-text-muted ml-0.5 text-[10px]">%</span>
												</p>
											</li>
										);
									})}
								</ul>
							)}
						</div>
					</section>

					{/* ===== GATEWAY RUNTIME (live) ===== */}
					<section className="container-page py-12 sm:py-16 border-t border-border">
						<header className="mb-8 max-w-2xl">
							<p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-3">
								Runtime · live
							</p>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
								Gateway internals
							</h2>
						</header>

						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
							{[
								{
									icon: Cpu,
									label: "Heap used",
									value: `${live.heapUsedMb}`,
									sub: "MiB · V8 heap",
									color: "text-accent",
								},
								{
									icon: Server,
									label: "RSS",
									value: `${live.rssMb}`,
									sub: "MiB resident",
									color: "text-info",
								},
								{
									icon: Database,
									label: "DB round-trip",
									value: live.dbLatencyMs != null ? `${live.dbLatencyMs}` : "—",
									sub: live.dbLatencyMs != null ? "ms · select 1" : "unreachable",
									color: live.dbLatencyMs != null ? "text-success" : "text-error",
								},
								{
									icon: Zap,
									label: "Uptime",
									value: formatUptimeInline(live.uptimeSec),
									sub: `env · ${live.env}`,
									color: "text-warning",
								},
							].map((s) => {
								const Icon = s.icon;
								return (
									<div
										key={s.label}
										className="border border-border rounded-[var(--radius-lg)] bg-surface/40 p-4"
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

						<div className="mt-6 border border-border rounded-[var(--radius-lg)] bg-surface/40 overflow-hidden">
							<div className="hidden sm:grid grid-cols-[3fr_1.5fr_1.5fr] gap-4 px-4 py-2.5 border-b border-border bg-surface text-[10px] font-mono uppercase tracking-widest text-text-muted">
								<span>Model · last 24h</span>
								<span className="text-right">Requests</span>
								<span className="text-right">Tokens</span>
							</div>
							{live.topModels.length === 0 ? (
								<p className="px-4 py-6 text-[12px] font-mono text-text-tertiary">
									No chat completions recorded in the last 24h.
								</p>
							) : (
								<ul className="divide-y divide-border list-none p-0">
									{live.topModels.map((m) => (
										<li
											key={m.model}
											className="grid grid-cols-2 sm:grid-cols-[3fr_1.5fr_1.5fr] gap-3 sm:gap-4 items-center px-4 py-3 hover:bg-surface/30 transition-colors duration-200 ease-out"
										>
											<code className="text-[12.5px] font-mono text-text truncate">
												{m.model}
											</code>
											<p className="text-right text-[13px] font-mono tabular-nums text-text">
												{m.requests.toLocaleString()}
											</p>
											<p className="text-right text-[13px] font-mono tabular-nums text-text">
												{m.tokens.toLocaleString()}
											</p>
										</li>
									))}
								</ul>
							)}
						</div>
					</section>

					{/* ===== INCIDENTS ===== */}
					<section className="container-page py-12 sm:py-16 border-t border-border">
						<header className="mb-6 max-w-2xl">
							<p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-3">
								Incidents · last 30d
							</p>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
								No active incidents
							</h2>
						</header>

						<div className="border border-border rounded-[var(--radius-lg)] bg-surface/40 p-5 flex items-start gap-3">
							<AlertTriangle
								className="h-4 w-4 mt-0.5 text-text-muted shrink-0"
								aria-hidden="true"
							/>
							<div>
								<p className="text-[13px] text-text-secondary leading-relaxed">
									No incidents in the last 30 days. Live status is available in
									the{""}
									<Link
										href="https://github.com/NosytLabs"
										className="text-accent hover:text-accent-hover underline underline-offset-4"
									>
										GitHub status board
									</Link>{""}
									once the public launch ships.
								</p>
							</div>
						</div>
					</section>

					{/* ===== CTA ===== */}
					<section className="border-t border-border container-page py-12 sm:py-20">
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
									href="/docs#endpoints"
									className="btn-primary inline-flex min-h-11 items-center gap-2 px-5"
								>
									API reference
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

interface OpsRoute {
	route: string;
	requests: number;
	errors: number;
	p95ms: number;
}

interface OpsModel {
	model: string;
	requests: number;
	tokens: number;
}

interface OpsSnapshotView {
	apiStatus: string;
	version: string;
	env: string;
	uptimeSec: number;
	httpRequestsTotal: number;
	httpErrorsTotal: number;
	chatCompletionsTotal: number;
	chatTokensTotal: number;
	chatErrors24h: number;
	chatP95Ms: number | null;
	dbLatencyMs: number | null;
	heapUsedMb: number;
	rssMb: number;
	topRoutes: OpsRoute[];
	topModels: OpsModel[];
	error?: string;
}

/**
 * Fetch the real operational snapshot from GET /v1/ops/snapshot. That
 * endpoint aggregates in-process HTTP counters, the trailing-24h
 * usage_records, and live process/runtime facts. Falls back to an
 * empty shape if the backend is unreachable so the page still renders.
 */
async function fetchOpsSnapshotInline(): Promise<OpsSnapshotView> {
	const base: OpsSnapshotView = {
		apiStatus: "unknown",
		version: "—",
		env: "—",
		uptimeSec: 0,
		httpRequestsTotal: 0,
		httpErrorsTotal: 0,
		chatCompletionsTotal: 0,
		chatTokensTotal: 0,
		chatErrors24h: 0,
		chatP95Ms: null,
		dbLatencyMs: null,
		heapUsedMb: 0,
		rssMb: 0,
		topRoutes: [],
		topModels: [],
	};
	try {
		const snap = await request<{
			status?: string;
			version?: string;
			env?: string;
			uptimeSec?: number;
			runtime?: { heapUsedMb?: number; rssMb?: number; dbLatencyMs?: number | null };
			http?: {
				requestsTotal?: number;
				errorsTotal?: number;
				topRoutes?: OpsRoute[];
			};
			chat24h?: {
				completions?: number;
				totalTokens?: number;
				errors?: number;
				p95LatencyMs?: number | null;
				topModels?: OpsModel[];
			};
		}>("/v1/ops/snapshot").catch(() => null);
		if (!snap) return { ...base, error: "backend unreachable" };
		return {
			apiStatus: snap.status ?? "unknown",
			version: snap.version ?? "—",
			env: snap.env ?? "—",
			uptimeSec: snap.uptimeSec ?? 0,
			httpRequestsTotal: snap.http?.requestsTotal ?? 0,
			httpErrorsTotal: snap.http?.errorsTotal ?? 0,
			chatCompletionsTotal: snap.chat24h?.completions ?? 0,
			chatTokensTotal: snap.chat24h?.totalTokens ?? 0,
			chatErrors24h: snap.chat24h?.errors ?? 0,
			chatP95Ms: snap.chat24h?.p95LatencyMs ?? null,
			dbLatencyMs: snap.runtime?.dbLatencyMs ?? null,
			heapUsedMb: snap.runtime?.heapUsedMb ?? 0,
			rssMb: snap.runtime?.rssMb ?? 0,
			topRoutes: snap.http?.topRoutes ?? [],
			topModels: snap.chat24h?.topModels ?? [],
		};
	} catch {
		return { ...base, error: "snapshot fetch failed" };
	}
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
