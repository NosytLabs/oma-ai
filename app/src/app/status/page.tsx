/* OMA · Status page
 * Honest pre-launch status. Until live metrics ship, no fake uptime numbers,
 * no invented latency, no fabricated incident history.
 */

import {
	ArrowLeft,
	CheckCircle2,
	ExternalLink,
	Github,
	Radio,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusDot } from "@/components/ui/StatusDot";

export const metadata: Metadata = {
	title: "Status",
	description:
		"OMA AI system status. Currently in pre-launch — live uptime and incident tracking will ship with the public launch.",
	alternates: { canonical: "/status" },
	openGraph: {
		title: "Status",
		description:
			"OMA AI system status. Pre-launch — live metrics ship with public launch.",
	},
	twitter: {
		card: "summary_large_image",
		title: "Status",
		description: "OMA AI system status — currently pre-launch.",
	},
};

type ServiceStatus = "ready" | "pending";

interface Service {
	name: string;
	description: string;
	status: ServiceStatus;
}

const SERVICES: readonly Service[] = [
	{
		name: "API Gateway",
		description: "OpenAI-compatible endpoints · /v1/chat/completions, /v1/models",
		status: "ready",
	},
	{
		name: "Authentication",
		description: "SIWE wallet sign-in · session tokens · API key verification",
		status: "ready",
	},
	{
		name: "Credit Engine",
		description: "Balance checks · per-token deduction · credit preflight",
		status: "ready",
	},
	{
		name: "x402 Settlement",
		description: "USDC payment verification · EIP-3009 transfers · Base chain",
		status: "ready",
	},
	{
		name: "Image Generation",
		description: "Stable Diffusion · Flux · upstream provider routing",
		status: "ready",
	},
	{
		name: "Video Generation",
		description: "Hailuo · Runway · Kling via upstream providers",
		status: "ready",
	},
	{
		name: "Deposit Watcher",
		description: "USDC deposit detection · credit issuance · Base chain indexing",
		status: "ready",
	},
	{
		name: "Dashboard",
		description: "Web UI · API key management · usage analytics · settings",
		status: "ready",
	},
] as const;

function StatusBadge({ status }: { status: ServiceStatus }) {
	const map: Record<
		ServiceStatus,
		{ label: string; color: string; dot: "accent" | "warning" }
	> = {
		ready: { label: "Ready", color: "text-accent", dot: "accent" },
		pending: { label: "Pending launch", color: "text-warning", dot: "warning" },
	};
	const info = map[status];
	return (
		<span
			className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${info.color}`}
		>
			<StatusDot tone={info.dot} />
			{info.label}
		</span>
	);
}

/* ============================================================
   PAGE
   ============================================================ */

export default function StatusPage() {
	const readyCount = SERVICES.filter((s) => s.status === "ready").length;
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
								<span className="inline-flex items-center gap-2 rounded-full border border-warning/20 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning">
									<span
										className="h-1.5 w-1.5 rounded-full bg-warning"
										aria-hidden="true"
									/>
									Pre-launch
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
									<span className="block text-accent">ready.</span>
								</h1>

								<p
									className="mt-6 max-w-2xl text-[15px] sm:text-base text-text leading-relaxed"
									style={{ textWrap: "pretty" }}
								>
									The OMA platform is fully built and ready to route traffic.
									Live uptime metrics and a public incident history will be
									published here when the public launch goes live.
								</p>

								<div className="mt-6 flex items-center gap-4 text-[12px] text-text-muted">
									<span className="inline-flex items-center gap-1.5">
										<Radio
											className="h-3.5 w-3.5 text-text-muted"
											aria-hidden="true"
										/>
										Live monitoring: pending launch
									</span>
									<span className="text-border">·</span>
									<span>Last reviewed: 2026-07-02</span>
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
									<StatusBadge status="ready" />
								</div>
								<dl className="text-[12px]">
									<div className="grid grid-cols-2 gap-2 px-4 py-2 border-b border-border">
										<dt className="text-text-muted text-[11.5px]">Services</dt>
										<dd className="text-text-secondary tabular-nums truncate text-right">
											{readyCount}/{totalCount} ready
										</dd>
									</div>
									<div className="grid grid-cols-2 gap-2 px-4 py-2 border-b border-border">
										<dt className="text-text-muted text-[11.5px]">
											Live uptime
										</dt>
										<dd className="text-text-secondary tabular-nums truncate text-right">
											pending launch
										</dd>
									</div>
									<div className="grid grid-cols-2 gap-2 px-4 py-2 border-b border-border">
										<dt className="text-text-muted text-[11.5px]">
											Incidents
										</dt>
										<dd className="text-text-secondary tabular-nums truncate text-right">
											none yet
										</dd>
									</div>
									<div className="grid grid-cols-2 gap-2 px-4 py-2">
										<dt className="text-text-muted text-[11.5px]">
											Last incident
										</dt>
										<dd className="text-text-secondary tabular-nums truncate text-right">
											—
										</dd>
									</div>
								</dl>
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
								Service readiness
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								Each component of the OMA platform and whether it&apos;s built
								and ready to serve traffic at launch.
							</p>
						</header>

						<ul className="divide-y divide-border border border-border bg-surface rounded-xl overflow-hidden">
							{SERVICES.map((service) => (
								<li
									key={service.name}
									className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-5 py-4"
								>
									<div className="min-w-0">
										<p className="text-[13px] sm:text-[14px] font-semibold text-text-bright truncate">
											{service.name}
										</p>
										<p className="text-[11px] sm:text-[12px] text-text-muted truncate mt-0.5">
											{service.description}
										</p>
									</div>
									<div className="shrink-0">
										<StatusBadge status={service.status} />
									</div>
								</li>
							))}
						</ul>
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
								Incident history
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								Past disruptions will be documented here with full
								post-mortems once the platform is serving production traffic.
							</p>
						</header>

						<div className="border border-border bg-surface p-8 rounded-xl text-center">
							<CheckCircle2
								className="h-8 w-8 text-accent mx-auto mb-3"
								aria-hidden="true"
							/>
							<p className="text-[14px] font-semibold text-text-bright mb-1">
								No incidents yet
							</p>
							<p className="text-[12.5px] text-text-muted">
								The platform has not yet entered public beta. There is
								nothing to report — and that is the report.
							</p>
						</div>
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
								How we&apos;ll monitor
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								What this page will measure once the platform is live. We
								publish the methodology up front so the numbers can be
								audited later.
							</p>
						</header>

						<div className="grid gap-3 sm:grid-cols-2">
							{[
								{
									title: "API health checks",
									body: "Automated requests to /api/health on a 60-second cadence. Failures page the on-call within 2 minutes.",
								},
								{
									title: "Upstream monitoring",
									body: "Every Venice and AntSeed key is pinged on a 5-minute cycle. Degraded keys are rotated automatically and surfaced here.",
								},
								{
									title: "Base chain indexer",
									body: "Deposit watcher tracks USDC transfers in real time. Backlog depth is monitored and alerts at 50+ blocks behind head.",
								},
								{
									title: "Independent status page",
									body: "This page is served from a separate edge function. Even if the main API is down, this page stays up and reports it.",
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
								for launch updates. When the platform goes live, real-time
								status and incident history will be published here and on X.
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