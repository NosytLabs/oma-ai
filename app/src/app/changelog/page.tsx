/* OMA · Changelog page
 * Distinctive editorial layout — like a network operator's release dispatch.
 * Sections: hero · latest release card · release archive · subscribe CTA.
 * Patterned after GitLab's monthly release notes style.
 */

import {
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	GitBranch,
	Rss,
	Sparkles,
	Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MODEL_COUNT } from "@/lib/models-data";
import { ElectricBorder } from "@/components/electric-border";
import { FloatingIcons } from "@/components/floating-icons";
import { JuiceButton } from "@/components/juice-button";

export const metadata: Metadata = {
	title: "Product Changelog — releases & fixes",
	description:
		"Every release and commit-worthy change to OMA AI: new models, gateway fixes, payment rails, and network primitives.",
	alternates: { canonical: "/changelog" },
	openGraph: {
		title: "Product Changelog — OMA",
		description:
			"Release notes for OMA AI: new models, gateway fixes, payment rails, and network primitives.",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA Changelog" }],
	},
};

type ChangeKind = "feature" | "fix" | "perf" | "deprecation";

interface Change {
	kind: ChangeKind;
	text: string;
}

interface Release {
	version: string;
	date: string;
	codename: string;
	summary: string;
	changes: Change[];
	highlights?: string[];
}

const KIND_STYLES: Record<ChangeKind, { label: string; color: string; icon: typeof Sparkles }> = {
	feature: { label: "feature", color: "bg-accent-dim text-accent border-accent/30", icon: Sparkles },
	fix: { label: "fix", color: "bg-info/10 text-info border-info/30", icon: Wrench },
	perf: { label: "perf", color: "bg-warning/10 text-warning border-warning/30", icon: GitBranch },
	deprecation: { label: "deprecation", color: "bg-error/10 text-error border-error/30", icon: Wrench },
};

const RELEASES: Release[] = [
	{
		version: "2.1.2",
		date: "2026-07-20",
		codename: "Polish & Accessibility",
		summary:
			"Comprehensive debug/audit sweep: focus traps on critical modals, structured JSON-LD on every deep page, and codebase hygiene pass that retired three stale docs and four webpack cache artifacts.",
		highlights: [
			"Modal focus traps: 2FA setup, 2FA disable, and API key revoke dialogs now trap Tab focus and restore on close",
			"JSON-LD structured data: BreadcrumbList on 5 deep pages, Product + FAQPage on /pricing",
			"Retired 3 stale root docs (DEPLOYMENT.md, CLOUDFLARE-TUNNEL.md, docs/roadmap.md)",
		],
		changes: [
			{ kind: "feature", text: "useFocusTrap hook (lib/hooks/useFocusTrap.ts) for accessible modal focus management" },
			{ kind: "feature", text: "BreadcrumbListJsonLd component on /pricing, /about, /contact, /docs, /models" },
			{ kind: "feature", text: "ProductJsonLd + FAQPageJsonLd on /pricing" },
			{ kind: "fix", text: "CSRF token fetch errors now log a warning instead of silently swallowing" },
			{ kind: "fix", text: "ProfileSection sound toggle now stays in sync with the persisted store (was mixed controlled/uncontrolled)" },
			{ kind: "fix", text: "Dashboard auto-refresh errors now log a warning instead of silently swallowing" },
			{ kind: "deprecation", text: "Remove DEPLOYMENT.md and CLOUDFLARE-TUNNEL.md — superseded by Cloudflare Pages direct deploys" },
			{ kind: "deprecation", text: "Remove docs/roadmap.md — moved to GitHub Projects" },
		],
	},
	{
		version: "2.1.1",
		date: "2026-07-14",
		codename: "Site Hardening",
		summary:
			"Marketing/product honesty pass: SEO sitemap cleanup, agent session demos, live observability counters, and retirement of the dead swap surface.",
		highlights: [
			"Public sitemap lists marketing routes only (no auth soft-404s)",
			"Agent session demo on homepage + docs (terminal UI for OpenAI baseURL story)",
			"Observability page shows live /health + /metrics counters",
			"Retired /swap → /deposit (direct USDC funding)",
		],
		changes: [
			{ kind: "feature", text: "AgentSessionDemo marketing block (brainless-inspired, OMA-themed)" },
			{ kind: "feature", text: "Live ops snapshot on /observability from Prometheus /metrics" },
			{ kind: "feature", text: "About + Contact trust pages; sub-processor disclosure in Privacy" },
			{ kind: "fix", text: "Anonymous /api/user returns 204 (no console 401 spam)" },
			{ kind: "fix", text: "CSP frame-ancestors none; prod drops unsafe-eval" },
			{ kind: "deprecation", text: "Remove standalone /swap — fund via USDC deposit on Base" },
		],
	},
	{
		version: "2.1.0",
		date: "2026-07-06",
		codename: "Network Operator",
		summary:
			"Four-theme palette system, three new product surfaces (Network, Changelog, Observability), and a broader model catalog across flagship and open-weight tiers.",
		highlights: [
			`${MODEL_COUNT}+ models available across the current public catalog`,
			"Four-theme palette (Emerald, Amber, Mono, Synth) — one-click switcher in the navbar",
			"New `/network` page — programmable network primitives inspired by GSMA OpenGateway",
			"New `/observability` page — per-route latency, error budget, request volume",
			"New `/changelog` page (you are here) — monthly release notes",
		],
		changes: [
			{ kind: "feature", text: "Four-theme palette system with persisted localStorage" },
			{ kind: "feature", text: "Network primitives surface at /network" },
			{ kind: "feature", text: "Observability dashboard at /observability" },
			{ kind: "feature", text: "MCP server (Model Context Protocol) — `npx @oma-ai/mcp`" },
			{ kind: "feature", text: "Agent card at /.well-known/agent-card.json" },
			{ kind: "feature", text: "Webhooks for deposit, credit-low, and request-failed events" },
			{ kind: "feature", text: "Per-route rate limits surfaced in dashboard" },
			{ kind: "perf", text: "60% reduction in p99 chat completion latency via streaming rewrite" },
			{ kind: "perf", text: "Credit preflight now streams in parallel with provider call (saves ~80ms)" },
			{ kind: "fix", text: "Fix intermittent 502 on USDC deposits under heavy load" },
			{ kind: "fix", text: "Resolve SIWE nonce expiry edge case at exactly 10 minutes" },
			{ kind: "fix", text: "Image generation: reject malformed masks instead of charging credits" },
			{ kind: "deprecation", text: "Deprecate `/v1/completions` legacy endpoint (sunset 2026-10-01)" },
		],
	},
	{
		version: "2.0.0",
		date: "2026-06-15",
		codename: "Permissionless",
		summary:
			"Major release: x402 pay-per-request becomes a first-class citizen. Wallet-only auth replaces email-based signup. Deposit watcher runs continuously on Base mainnet.",
		highlights: [
			"x402 pay-per-request — USDC settlement on every request without pre-funding",
			"Wallet-only authentication (SIWE) — no email, no password, no card",
			"Continuous deposit watcher — USDC credits within ~12 seconds of confirmation",
			"Multi-chain deposits via LI.FI / CCTP into USDC on Base",
		],
		changes: [
			{ kind: "feature", text: "x402 Payment Required flow on /v1/x402/* endpoints" },
			{ kind: "feature", text: "SIWE sign-in replaces email/password auth" },
			{ kind: "feature", text: "Deposit watcher runs as a continuous cron (was on-demand)" },
			{ kind: "feature", text: "Multi-chain deposit routing into USDC on Base (LI.FI / CCTP)" },
			{ kind: "perf", text: "3x throughput on chat completions via connection pooling" },
			{ kind: "fix", text: "Fix race condition between deposit watcher and manual settlement" },
		],
	},
	{
		version: "1.4.0",
		date: "2026-05-01",
		codename: "Multi-Modal",
		summary:
			"Image and video generation arrive at parity with chat. Credit preflight runs on every endpoint, including uploads.",
		changes: [
			{ kind: "feature", text: "/v1/images/generations — Stable Diffusion XL, Flux, Imagen" },
			{ kind: "feature", text: "/v1/videos/generations — Runway, Kling, Hailuo" },
			{ kind: "feature", text: "Per-image credit preflight (no surprise charges on failed jobs)" },
			{ kind: "fix", text: "Fix upload progress UI hanging on >50MB files" },
		],
	},
	{
		version: "1.3.0",
		date: "2026-03-18",
		codename: "Failover",
		summary:
			"Circuit breaker across upstream providers. If Venice goes down, OMA fails over to AntSeed within 8 seconds.",
		changes: [
			{ kind: "feature", text: "Circuit breaker with automatic recovery (8s window)" },
			{ kind: "feature", text: "Latency-optimized routing when multiple providers healthy" },
			{ kind: "perf", text: "Reduced cold-start latency by 40%" },
		],
	},
	{
		version: "1.2.0",
		date: "2026-02-10",
		codename: "Operator",
		summary: "Admin dashboard ships. Per-user usage, revenue, refund approvals.",
		changes: [
			{ kind: "feature", text: "Admin dashboard with revenue, usage, and refund tabs" },
			{ kind: "feature", text: "Admin override for individual rate limits" },
		],
	},
	{
		version: "1.1.0",
		date: "2026-01-08",
		codename: "Stable",
		summary: "First stable API. OpenAI-compatible schema frozen at v1.",
		changes: [
			{ kind: "feature", text: "/v1/chat/completions — full OpenAI schema compatibility" },
			{ kind: "feature", text: "/v1/embeddings — 1536-dim output" },
			{ kind: "fix", text: "Resolve streaming backpressure on long completions" },
		],
	},
	{
		version: "1.0.0",
		date: "2025-12-01",
		codename: "Genesis",
		summary: "First public release. Wallet auth, credit-based billing, single upstream provider.",
		changes: [
			{ kind: "feature", text: "Initial release — wallet auth, credit ledger, chat completions" },
		],
	},
];

export default function ChangelogPage() {
	const latest = RELEASES[0]!;
	const archive = RELEASES.slice(1);

	return (
		<div className="min-h-dvh bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
			<FloatingIcons />
			<div className="overflow-x-clip">
				<div className="flex flex-col">
					{/* ===== HERO ===== */}
					<section className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-10 sm:pb-14">
						<Link
							href="/"
							className="mb-6 inline-flex items-center gap-2 text-[12.5px] text-text-muted hover:text-accent transition-colors"
						>
							<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
							Back to home
						</Link>

						<div className="flex items-center gap-2 mb-5">
							<Rss className="h-4 w-4 text-accent" aria-hidden="true" />
							<span className="text-xs uppercase tracking-[0.18em] font-mono text-accent">
								/changelog
							</span>
						</div>

						<h1
							className="h1-page text-text-bright"
							style={{ textWrap: "balance" }}
						>
							<span className="block">Every release,{" "}</span>
							<span className="block text-accent">every shipped change.</span>
						</h1>

						<p className="mt-6 max-w-2xl text-[15px] sm:text-base text-text leading-relaxed">
							A monthly dispatch of what changed in OMA — new models,
							network primitives, performance fixes, and deprecations. No
							vendor-speak, no marketing. Just the diff.
						</p>

						<div className="mt-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-dim px-3 py-1.5 text-[11px] font-mono text-accent">
							<span
								className="h-1.5 w-1.5 rounded-full bg-accent pulse-ring"
								aria-hidden="true"
							/>
							latest · v{latest.version} · {latest.codename}
						</div>
					</section>

					{/* ===== LATEST RELEASE (featured) ===== */}
					<section className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
						<article className="relative border border-accent/30 rounded-xl overflow-hidden bg-gradient-to-br from-accent-dim via-surface to-surface">
							<span
								aria-hidden="true"
								className="absolute left-0 top-0 bottom-0 w-1 bg-accent"
							/>
							<div className="p-6 sm:p-8">
								<header className="flex flex-wrap items-center gap-3 mb-4">
									<span className="text-xs font-mono text-accent tabular-nums">
										v{latest.version}
									</span>
									<span className="text-xs font-mono text-text-muted tabular-nums">
										· {latest.date}
									</span>
									<span className="text-xs font-mono uppercase tracking-widest text-text-secondary">
										{latest.codename}
									</span>
								</header>

								<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright mb-3 leading-snug">
									{latest.summary}
								</h2>

								{latest.highlights && (
									<ul className="mt-5 space-y-2 list-none p-0">
										{latest.highlights.map((h, i) => (
											<li key={i} className="flex items-start gap-2.5 text-[13px] text-text">
												<CheckCircle2
													className="h-4 w-4 mt-0.5 shrink-0 text-accent"
													aria-hidden="true"
												/>
												<span>{h}</span>
											</li>
										))}
									</ul>
								)}

								<div className="mt-7 pt-5 border-t border-border">
									<p className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-3">
										Detailed changes
									</p>
									<ul className="space-y-2 list-none p-0">
										{latest.changes.map((c, i) => {
											const style = KIND_STYLES[c.kind];
											const Icon = style.icon;
											return (
												<li
													key={i}
													className="flex items-start gap-2.5 text-[13px] text-text-secondary"
												>
													<span
														className={`shrink-0 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${style.color}`}
													>
														<Icon className="h-2.5 w-2.5" aria-hidden="true" />
														{style.label}
													</span>
													<span className="flex-1 min-w-0">{c.text}</span>
												</li>
											);
										})}
									</ul>
								</div>
							</div>
						</article>
					</section>

					{/* ===== ARCHIVE ===== */}
					<section className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 border-t border-border">
						<header className="mb-8 max-w-2xl">
							<p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-3">
								Archive
							</p>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
								Earlier releases
							</h2>
						</header>

						<ol className="space-y-10 list-none p-0">
							{archive.map((r) => (
								<li key={r.version}>
									<article className="border-l-2 border-border pl-5 sm:pl-6 relative">
										<span
											aria-hidden="true"
											className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-border"
										/>
										<header className="flex flex-wrap items-baseline gap-x-3 mb-2">
											<span className="font-mono text-sm text-accent tabular-nums">
												v{r.version}
											</span>
											<span className="font-mono text-xs text-text-muted tabular-nums">
												{r.date}
											</span>
											<span className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary">
												{r.codename}
											</span>
										</header>
										<p className="text-[14px] text-text leading-relaxed mb-3">
											{r.summary}
										</p>
										<ul className="space-y-1.5 list-none p-0">
											{r.changes.map((c, i) => {
												const style = KIND_STYLES[c.kind];
												return (
													<li
														key={i}
														className="flex items-start gap-2 text-[12.5px] text-text-secondary"
													>
														<span
															className={`shrink-0 mt-0.5 inline-flex items-center rounded border px-1.5 py-px text-[9px] font-mono uppercase tracking-wider ${style.color}`}
														>
															{style.label}
														</span>
														<span className="flex-1 min-w-0">{c.text}</span>
													</li>
												);
											})}
										</ul>
									</article>
								</li>
							))}
						</ol>
					</section>

					{/* ===== SUBSCRIBE ===== */}
					<section className="border-t border-border mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
						<div className="rounded-2xl border border-accent/30 bg-accent-dim px-6 sm:px-10 py-10 sm:py-14 relative overflow-hidden">
							<span
								aria-hidden="true"
								className="absolute left-0 top-0 bottom-0 w-1 bg-accent"
							/>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright max-w-xl">
								Subscribe to release notes
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary max-w-xl leading-relaxed">
								One email per release. Major, minor, and patch — but only the
								ones that touch the public API or add a model. No marketing.
							</p>
							<div className="mt-6 flex flex-wrap items-center gap-3">
								<JuiceButton
									color="var(--color-accent)"
									size={140}
									opacity={0.15}
									className="rounded-lg"
								>
									<ElectricBorder borderRadius="8px" borderWidth={1} active={true}>
										<Link
											href="https://github.com/NosytLabs/oma-ai/releases"
											target="_blank"
											rel="noopener noreferrer"
											className="btn-primary inline-flex min-h-11 items-center gap-2 px-5"
										>
											<Rss className="h-4 w-4" aria-hidden="true" />
											RSS feed
											<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
										</Link>
									</ElectricBorder>
								</JuiceButton>
								<Link
									href="https://github.com/NosytLabs/oma-ai"
									target="_blank"
									rel="noopener noreferrer"
									className="btn-secondary inline-flex min-h-11 items-center gap-2 px-5"
								>
									Watch on GitHub
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
