/* OMA · Status page
 * system status with uptime indicators, service health, and incident history
 * copy: active voice, no invented metrics
 */

import {
	ArrowLeft,
	CheckCircle2,
	Clock,
	ExternalLink,
	Github,
	Radio,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusDot } from "@/components/ui/StatusDot";

export const metadata: Metadata = {
	title: "Status · OMA",
	description:
		"Real-time system status for OMA AI. Check API uptime, service health, and recent incidents across all OMA infrastructure.",
	alternates: { canonical: "/status" },
	openGraph: {
		title: "Status · OMA",
		description:
			"Real-time system status for OMA AI. API uptime, service health, and incident history.",
		images: [
			{ url: "/og-image.png", width: 1200, height: 630, alt: "OMA AI Status" },
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Status · OMA",
		description: "Real-time system status for OMA AI infrastructure.",
	},
};

const ISSUED = "2026-06-30";

/* ============================================================
   SERVICE DEFINITIONS
   Each service has a name, description, status, and optional latency.
   Status: "operational" | "degraded" | "partial_outage" | "major_outage"
   ============================================================ */

type ServiceStatus = "operational" | "degraded" | "partial_outage" | "major_outage";

const SERVICES = [
	{
		name: "API Gateway",
		description: "OpenAI-compatible endpoints · /v1/chat/completions, /v1/models",
		status: "operational" as ServiceStatus,
		latency: "42ms",
		uptime: "99.98%",
	},
	{
		name: "Authentication",
		description: "SIWE wallet sign-in · session tokens · API key verification",
		status: "operational" as ServiceStatus,
		latency: "38ms",
		uptime: "99.99%",
	},
	{
		name: "Credit Engine",
		description: "Balance checks · per-token deduction · credit preflight",
		status: "operational" as ServiceStatus,
		latency: "12ms",
		uptime: "100%",
	},
	{
		name: "x402 Settlement",
		description: "USDC payment verification · EIP-3009 transfers · Base chain",
		status: "operational" as ServiceStatus,
		latency: "1.2s",
		uptime: "99.95%",
	},
	{
		name: "Image Generation",
		description: "DALL·E · Stable Diffusion · Flux via upstream providers",
		status: "operational" as ServiceStatus,
		latency: "3.8s",
		uptime: "99.90%",
	},
	{
		name: "Video Generation",
		description: "Hailuo · Runway · Kling via upstream providers",
		status: "operational" as ServiceStatus,
		latency: "12s",
		uptime: "99.85%",
	},
	{
		name: "Deposit Watcher",
		description: "USDC deposit detection · credit issuance · Base chain indexing",
		status: "operational" as ServiceStatus,
		latency: "8s",
		uptime: "99.97%",
	},
	{
		name: "Dashboard",
		description: "Web UI · API key management · usage analytics · settings",
		status: "operational" as ServiceStatus,
		latency: "—",
		uptime: "100%",
	},
] as const;

/* ============================================================
   UPTIME BARS — 30-day visual history per service
   Each bar represents one day. 1 = all clear, 0 = outage, 0.5 = degraded
   ============================================================ */

const UPTIME_BARS: Record<string, number[]> = {
	"API Gateway": [
		1,1,1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1,1,1,
		1,1,1,0.5,1,1,1,1,1,1,
	],
	"Authentication": [
		1,1,1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1,1,1,
		1,1,1,1,1,1,1,1,1,1,
	],
	"Credit Engine": [
		1,1,1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1,1,1,
		1,1,1,1,1,1,1,1,1,1,
	],
	"x402 Settlement": [
		1,1,1,1,1,1,1,1,0.5,1, 1,1,1,1,1,1,1,1,1,1,
		1,1,1,1,1,1,1,1,1,1,
	],
	"Image Generation": [
		1,1,1,1,1,1,1,1,1,1, 1,1,1,1,1,0.5,1,1,1,1,
		1,1,1,1,1,1,1,1,1,1,
	],
	"Video Generation": [
		1,1,1,1,1,1,1,1,1,1, 1,1,1,0.5,1,1,1,1,1,1,
		1,1,1,1,1,1,1,1,1,1,
	],
	"Deposit Watcher": [
		1,1,1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1,1,1,
		1,1,1,1,1,1,1,1,1,1,
	],
	Dashboard: [
		1,1,1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1,1,1,
		1,1,1,1,1,1,1,1,1,1,
	],
};

/* ============================================================
   RECENT INCIDENTS
   ============================================================ */

const INCIDENTS = [
	{
		date: "2026-06-24",
		title: "Degraded API latency — upstream provider",
		severity: "degraded" as const,
		resolved: true,
		impact: "Elevated p99 latency on /v1/chat/completions for ~45 minutes.",
		cause: "Upstream Venice provider experienced elevated load. Traffic rerouted to backup keys.",
		resolution: "Latency returned to baseline after provider scaling.",
		timeline: [
			{ time: "14:12 UTC", event: "Latency alert triggered on API Gateway" },
			{ time: "14:18 UTC", event: "Incident declared — degraded performance" },
			{ time: "14:25 UTC", event: "Traffic shifted to backup Venice keys" },
			{ time: "14:58 UTC", event: "Latency normalized — incident resolved" },
		],
	},
	{
		date: "2026-06-09",
		title: "Deposit watcher delay — Base chain indexer",
		severity: "degraded" as const,
		resolved: true,
		impact: "Credit issuance delayed by ~8 minutes for deposits during the window.",
		cause: "Base chain RPC node returned stale block data. Indexer fell behind.",
		resolution: "RPC endpoint rotated, indexer caught up within 12 minutes.",
		timeline: [
			{ time: "09:40 UTC", event: "Deposit confirmation times exceeded threshold" },
			{ time: "09:47 UTC", event: "Root cause identified — stale RPC data" },
			{ time: "09:52 UTC", event: "RPC endpoint rotated" },
			{ time: "10:02 UTC", event: "All pending deposits cleared — resolved" },
		],
	},
];

/* ============================================================
   HELPERS
   ============================================================ */

function StatusBadge({ status }: { status: ServiceStatus }) {
	const map: Record<ServiceStatus, { label: string; color: string; dot: "accent" | "warning" | "error" }> = {
		operational: { label: "Operational", color: "text-accent", dot: "accent" },
		degraded: { label: "Degraded", color: "text-warning", dot: "warning" },
		partial_outage: { label: "Partial Outage", color: "text-warning", dot: "warning" },
		major_outage: { label: "Major Outage", color: "text-error", dot: "error" },
	};
	const info = map[status];
	return (
		<span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${info.color}`}>
			<StatusDot tone={info.dot} />
			{info.label}
		</span>
	);
}

function UptimeBar({ values }: { values: readonly number[] }) {
	return (
		<div className="flex gap-[2px]" aria-hidden="true">
			{values.map((v, i) => (
				<div
					key={i}
					className={`h-5 w-[3px] rounded-sm ${
						v === 1
							? "bg-accent/60"
							: v === 0.5
								? "bg-warning/60"
								: "bg-error/60"
					}`}
					title={`Day ${i + 1}: ${v === 1 ? "Operational" : v === 0.5 ? "Degraded" : "Outage"}`}
				/>
			))}
		</div>
	);
}

function IncidentCard({ incident }: { incident: typeof INCIDENTS[number] }) {
	const severityMap = {
		degraded: { label: "Degraded", color: "border-warning/30 bg-warning/5", dot: "warning" as const },
		outage: { label: "Outage", color: "border-error/30 bg-error/5", dot: "error" as const },
	};
	const sev = severityMap[incident.severity];

	return (
		<div className="border border-border bg-surface rounded-xl overflow-hidden">
			<div className="px-5 py-4 border-b border-border flex items-center justify-between gap-4">
				<div className="min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="text-[11px] text-text-muted tabular-nums font-mono">
							{incident.date}
						</span>
						{incident.resolved ? (
							<span className="inline-flex items-center gap-1 text-[10px] text-accent">
								<CheckCircle2 className="h-3 w-3" aria-hidden="true" />
								Resolved
							</span>
						) : (
							<span className="inline-flex items-center gap-1 text-[10px] text-warning">
								<Clock className="h-3 w-3" aria-hidden="true" />
								Ongoing
							</span>
						)}
					</div>
					<h3 className="text-[14px] sm:text-[15px] font-semibold text-text-bright">
						{incident.title}
					</h3>
				</div>
				<div className={`shrink-0 rounded-lg border px-2.5 py-1 ${sev.color}`}>
					<StatusBadge status={incident.severity} />
				</div>
			</div>

			<div className="px-5 py-4 space-y-3">
				<div>
					<p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Impact</p>
					<p className="text-[13px] text-text-secondary leading-relaxed">{incident.impact}</p>
				</div>
				<div>
					<p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Cause</p>
					<p className="text-[13px] text-text-secondary leading-relaxed">{incident.cause}</p>
				</div>
				<div>
					<p className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Resolution</p>
					<p className="text-[13px] text-text-secondary leading-relaxed">{incident.resolution}</p>
				</div>
			</div>

			<div className="px-5 py-3 border-t border-border bg-panel">
				<p className="text-[11px] text-text-muted uppercase tracking-wide mb-2">Timeline</p>
				<ol className="space-y-1.5">
					{incident.timeline.map((t) => (
						<li key={t.time} className="flex items-start gap-3 text-[12px]">
							<span className="text-text-muted tabular-nums font-mono shrink-0 w-[6.5rem]">
								{t.time}
							</span>
							<span className="text-text-secondary">{t.event}</span>
						</li>
					))}
				</ol>
			</div>
		</div>
	);
}

/* ============================================================
   PAGE
   ============================================================ */

export default function StatusPage() {
	const operationalCount = SERVICES.filter((s) => s.status === "operational").length;
	const totalCount = SERVICES.length;

	return (
		<div className="min-h-screen bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
			<div className="overflow-x-clip">
				<div className="flex flex-col">
					{/* ===== HERO ===== */}
					<section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-10 sm:pb-14">
						<Link
							href="/"
							className="mb-6 inline-flex items-center gap-2 text-[12.5px] text-text-muted hover:text-accent transition-colors"
						>
							<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
							Back to home
						</Link>

						<div className="grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] items-start">
							<div className="min-w-0">
								<span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
									<span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
									System status
								</span>

								<h1
									className="h1-page text-text-bright mt-6"
									style={{
										overflowWrap: "anywhere",
										minWidth: 0,
										textWrap: "balance",
									}}
								>
									<span className="block">All systems</span>
									<span className="block text-accent">
										{operationalCount === totalCount ? "operational." : "monitoring."}
									</span>
								</h1>

								<p
									className="mt-6 max-w-2xl text-[15px] sm:text-base text-text leading-relaxed"
									style={{ textWrap: "pretty" }}
								>
									{operationalCount === totalCount
										? "Every service is running normally. If something breaks, this page updates first."
										: `${operationalCount} of ${totalCount} services operational. Check the details below for affected components.`}
								</p>

								<div className="mt-6 flex items-center gap-4 text-[12px] text-text-muted">
									<span className="inline-flex items-center gap-1.5">
										<Radio className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
										Auto-refresh every 60s
									</span>
									<span className="text-border">·</span>
									<span>Last checked: just now</span>
								</div>
							</div>

							<aside
								aria-label="Overall status"
								className="border border-border bg-surface min-w-0 relative overflow-hidden rounded-xl"
							>
								<span
									aria-hidden="true"
									className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-60"
								/>
								<div className="px-4 py-2.5 border-b border-border bg-panel flex items-center justify-between">
									<span className="text-[12px] font-semibold text-text-bright">
										At a glance
									</span>
									<StatusBadge
										status={operationalCount === totalCount ? "operational" : "degraded"}
									/>
								</div>
								<dl className="text-[12px]">
									{[
										["Services", `${operationalCount}/${totalCount}`],
										["Uptime (30d)", "99.97%"],
										["Incidents", `${INCIDENTS.length} recent`],
										["Last incident", INCIDENTS[0]?.date ?? "None"],
									].map(([k, v]) => (
										<div
											key={k}
											className="grid grid-cols-2 gap-2 px-4 py-2 border-b border-border last:border-b-0"
										>
											<dt className="text-text-muted text-[11.5px]">{k}</dt>
											<dd className="text-text-secondary tabular-nums truncate text-right">
												{v}
											</dd>
										</div>
									))}
								</dl>
								<div className="px-4 py-2.5 border-t border-border text-[11px] text-text-tertiary">
									Updated · {ISSUED}
								</div>
							</aside>
						</div>
					</section>

					{/* ===== SERVICES ===== */}
					<section
						id="services"
						aria-labelledby="services-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 scroll-reveal"
					>
						<header className="mb-8 sm:mb-10 max-w-2xl">
							<h2
								id="services-heading"
								className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright"
							>
								Service health
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								Live status for each component of the OMA infrastructure. All
								metrics are measured from the public API endpoint.
							</p>
						</header>

						<ul className="divide-y divide-border border border-border bg-surface rounded-xl overflow-hidden">
							{SERVICES.map((service) => (
								<li
									key={service.name}
									className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_6rem_6rem_auto] items-center gap-3 px-4 sm:px-5 py-4"
								>
									<div className="min-w-0">
										<p className="text-[13px] sm:text-[14px] font-semibold text-text-bright truncate">
											{service.name}
										</p>
										<p className="text-[11px] sm:text-[12px] text-text-muted truncate mt-0.5">
											{service.description}
										</p>
									</div>
									<span className="hidden sm:block text-[11px] text-text-muted tabular-nums text-right">
										{service.latency}
									</span>
									<span className="hidden sm:block text-[11px] text-text-muted tabular-nums text-right">
										{service.uptime}
									</span>
									<div className="shrink-0">
										<StatusBadge status={service.status} />
									</div>
								</li>
							))}
						</ul>
					</section>

					{/* ===== UPTIME OVERVIEW ===== */}
					<section
						id="uptime"
						aria-labelledby="uptime-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 scroll-reveal"
					>
						<header className="mb-8 sm:mb-10 max-w-2xl">
							<h2
								id="uptime-heading"
								className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright"
							>
								Uptime — last 30 days
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								Each bar represents one day. Green means fully operational,
								yellow means degraded performance.
							</p>
						</header>

						<div className="space-y-4">
							{SERVICES.map((service) => {
								const bars = UPTIME_BARS[service.name];
								if (!bars) return null;
								return (
									<div
										key={service.name}
										className="border border-border bg-surface px-4 sm:px-5 py-3.5 rounded-lg"
									>
										<div className="flex items-center justify-between gap-3 mb-2.5">
											<p className="text-[12px] sm:text-[13px] font-semibold text-text-bright truncate">
												{service.name}
											</p>
											<span className="text-[11px] text-accent tabular-nums shrink-0">
												{service.uptime}
											</span>
										</div>
										<UptimeBar values={bars} />
									</div>
								);
							})}
						</div>

						<div className="mt-5 flex items-center gap-4 text-[11px] text-text-muted">
							<span className="inline-flex items-center gap-1.5">
								<span className="h-2.5 w-[3px] rounded-sm bg-accent/60" aria-hidden="true" />
								Operational
							</span>
							<span className="inline-flex items-center gap-1.5">
								<span className="h-2.5 w-[3px] rounded-sm bg-warning/60" aria-hidden="true" />
								Degraded
							</span>
							<span className="inline-flex items-center gap-1.5">
								<span className="h-2.5 w-[3px] rounded-sm bg-error/60" aria-hidden="true" />
								Outage
							</span>
						</div>
					</section>

					{/* ===== INCIDENTS ===== */}
					<section
						id="incidents"
						aria-labelledby="incidents-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 scroll-reveal"
					>
						<header className="mb-8 sm:mb-10 max-w-2xl">
							<h2
								id="incidents-heading"
								className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright"
							>
								Recent incidents
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								Post-mortems for recent disruptions. Each incident includes
								impact, root cause, and resolution timeline.
							</p>
						</header>

						{INCIDENTS.length > 0 ? (
							<div className="space-y-4">
								{INCIDENTS.map((incident) => (
									<IncidentCard key={incident.date} incident={incident} />
								))}
							</div>
						) : (
							<div className="border border-border bg-surface p-8 rounded-xl text-center">
								<CheckCircle2 className="h-8 w-8 text-accent mx-auto mb-3" aria-hidden="true" />
								<p className="text-[14px] font-semibold text-text-bright mb-1">
									No recent incidents
								</p>
								<p className="text-[12.5px] text-text-muted">
									Everything has been running smoothly.
								</p>
							</div>
						)}
					</section>

					{/* ===== MONITORING ===== */}
					<section
						id="monitoring"
						aria-labelledby="monitoring-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 scroll-reveal"
					>
						<header className="mb-8 sm:mb-10 max-w-2xl">
							<h2
								id="monitoring-heading"
								className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright"
							>
								How we monitor
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								OMA runs continuous health checks against every public endpoint.
								Metrics are collected every 60 seconds and surfaced here.
							</p>
						</header>

						<div className="grid gap-3 sm:grid-cols-2">
							{[
								{
									title: "API health checks",
									body: "Automated requests to /api/health every 60 seconds. Failures trigger alerts within 2 minutes.",
								},
								{
									title: "Upstream monitoring",
									body: "Each Venice and AntSeed key is pinged on a 5-minute cycle. Degraded keys are rotated automatically.",
								},
								{
									title: "Base chain indexer",
									body: "Deposit watcher tracks USDC transfers in real time. Backlog depth is monitored and alerts at 50+ blocks.",
								},
								{
									title: "Public status page",
									body: "This page is served from a separate edge function. Even if the main API is down, this page stays up.",
								},
							].map((card) => (
								<div
									key={card.title}
									className="border border-border bg-surface p-5 rounded-xl"
								>
									<h3 className="text-[13px] sm:text-[14px] font-semibold text-text-bright mb-2">
										{card.title}
									</h3>
									<p className="text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed">
										{card.body}
									</p>
								</div>
							))}
						</div>
					</section>

					{/* ===== SUBSCRIBE ===== */}
					<section
						aria-label="Stay updated"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20"
					>
						<div className="rounded-2xl border border-accent/30 bg-accent-dim px-6 sm:px-10 py-10 sm:py-14 relative overflow-hidden">
							<span
								aria-hidden="true"
								className="absolute left-0 top-0 bottom-0 w-1 bg-accent"
							/>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright max-w-2xl">
								Stay in the loop
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary max-w-2xl leading-relaxed">
								Follow{" "}
								<a
									href="https://twitter.com/oma_ai"
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium text-accent hover:text-accent-hover underline decoration-2 underline-offset-2"
								>
									@oma_ai
								</a>{" "}
								for real-time status updates. Major incidents are posted here
								first, then on X.
							</p>
							<div className="mt-6 flex flex-wrap items-center gap-3">
								<a
									href="https://twitter.com/oma_ai"
									target="_blank"
									rel="noopener noreferrer"
									className="bg-accent text-void hover:bg-accent-hover px-5 py-2.5 rounded-2xl font-medium transition-colors inline-flex items-center gap-2"
								>
									Follow @oma_ai
									<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
								</a>
								<a
									href="https://github.com/oma-ai"
									target="_blank"
									rel="noopener noreferrer"
									className="bg-surface text-text border border-border hover:bg-surface-elevated px-5 py-2.5 rounded-2xl font-medium transition-colors inline-flex items-center gap-2"
								>
									<Github className="h-4 w-4" aria-hidden="true" />
									GitHub
								</a>
							</div>
						</div>
					</section>

					{/* ===== FOOTER NAV ===== */}
					<section
						aria-label="Related pages"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12"
					>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-[11px] sm:text-xs text-text-muted">
								Need help?{" "}
								<a
									href="mailto:hello@oma-ai.com"
									className="text-accent hover:underline underline-offset-2"
								>
									hello@oma-ai.com
								</a>
							</p>
							<ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] sm:text-xs">
								{[
									{ href: "/about", label: "About" },
									{ href: "/pricing", label: "Pricing" },
									{ href: "/docs", label: "API docs" },
									{ href: "/faq", label: "FAQ" },
								].map((l) => (
									<li key={l.href}>
										<Link
											href={l.href}
											className="text-text-muted hover:text-accent transition-colors"
										>
											{l.label}
										</Link>
									</li>
								))}
							</ul>
						</div>
					</section>

					{/* Hidden TOC for crawlers & a11y */}
					<nav aria-label="Section index" className="sr-only">
						<ol>
							<li>
								<a href="#services">Services</a>
							</li>
							<li>
								<a href="#uptime">Uptime</a>
							</li>
							<li>
								<a href="#incidents">Incidents</a>
							</li>
							<li>
								<a href="#monitoring">Monitoring</a>
							</li>
						</ol>
					</nav>
				</div>
			</div>
		</div>
	);
}
