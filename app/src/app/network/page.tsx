/* OMA · Network page
 *
 * Inspired by GSMA OpenGateway / CAMARA — network APIs as programmable
 * primitives. OMA-AI exposes a small set of network-primitive surfaces
 * for AI agents: token bucket rate limits, request signing, audit log,
 * circuit breaker telemetry, deposit watcher feeds.
 *
 * Distinctive aesthetic: this page leans heavily on the OMA terminal
 * motif (mono, ledger lines, tabular numbers, signal-bar visualizations)
 * to communicate "infrastructure" rather than "marketing".
 */

import {
	Activity,
	ArrowLeft,
	ArrowRight,
	Boxes,
	Fingerprint,
	GitBranch,
	KeyRound,
	Network,
	Radar,
	Receipt,
	Webhook,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ElectricBorder } from "@/components/electric-border";
import { FloatingIcons } from "@/components/floating-icons";
import { JuiceButton } from "@/components/juice-button";

// Opt out of static prerender — uses client-only visual components.

export const metadata: Metadata = {
	title: "Network Primitives — agent infrastructure APIs",
	description:
		"Programmable network primitives for AI agents: rate limits, request signing, audit log, telemetry, and deposit feeds as composable APIs.",
	alternates: { canonical: "/network" },
	openGraph: {
		title: "Network Primitives — OMA",
		description:
			"Programmable network primitives for AI agents: rate limits, signing, audit log, telemetry, deposit feeds.",
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA Network" }],
	},
	robots: { index: true, follow: true },
};

interface Primitive {
	id: string;
	name: string;
	icon: typeof Activity;
	tagline: string;
	endpoint: string;
	method: "GET" | "POST" | "WS";
	status: "stable" | "beta" | "alpha";
	description: string;
	example?: string;
}

const PRIMITIVES: Primitive[] = [
	{
		id: "rate-limit",
		name: "Token-Bucket Rate Limit",
		icon: Activity,
		tagline: "Programmable rate limits, per-route, per-model, per-key.",
		endpoint: "/v1/rate-limits/:key",
		method: "GET",
		status: "stable",
		description:
			"Inspect the live token-bucket state for any API key. Each key carries a per-model bucket and a global bucket. Inspect available tokens, refill rate, and backoff window without consuming a request.",
		example: 'GET /v1/rate-limits/oma_key_3j2k → { "available": 89, "refill_rate": 100, "next_token_ms": 12 }',
	},
	{
		id: "request-signing",
		name: "Request Signing (HMAC-Pinned)",
		icon: KeyRound,
		tagline: "Pin a downstream signer key. OMA rejects requests without the signature.",
		endpoint: "/v1/signing/pin",
		method: "POST",
		status: "stable",
		description:
			"Bind an HMAC public key to your account. Every subsequent request must include a signature header. Failed-pin requests return 401 with a 60-second lockout to slow brute-force probes.",
		example: 'POST /v1/signing/pin { "alg": "HS256", "key_id": "k_abc123" }',
	},
	{
		id: "audit",
		name: "Audit Log Feed",
		icon: Receipt,
		tagline: "Append-only event log of every key, deposit, refund, and rate-limit decision.",
		endpoint: "/v1/audit/events",
		method: "GET",
		status: "stable",
		description:
			"Stream the operator-internal audit log. Every key creation, deposit match, refund approval, and rate-limit decision is recorded with a sha256 chain hash so tampering is detectable.",
		example: 'GET /v1/audit/events?since=2026-07-06T00:00:00Z',
	},
	{
		id: "circuit",
		name: "Circuit-Breaker Telemetry",
		icon: GitBranch,
		tagline: "Live state of every upstream provider breaker.",
		endpoint: "/v1/upstream/health",
		method: "GET",
		status: "stable",
		description:
			"Inspect the circuit-breaker state for each upstream (Venice, Gonka). Includes 5-minute rolling error rate, average latency, and time-to-recovery.",
		example: 'GET /v1/upstream/health → { "venice": "closed", "gonka": "closed" }',
	},
	{
		id: "deposit",
		name: "Deposit Watcher Feed",
		icon: Radar,
		tagline: "Push feed of incoming USDC deposits matched to your wallet.",
		endpoint: "wss://api.oma-ai.com/v1/deposit/feed",
		method: "WS",
		status: "stable",
		description:
			"Open a websocket to receive push notifications of USDC deposits to the OMA deposit address that match your wallet. Latency from on-chain confirmation to message delivery is typically under 12 seconds.",
		example: "wss://api.oma-ai.com/v1/deposit/feed → { \"type\": \"deposit.matched\", \"amount\": \"50.00\", \"tx\": \"0x...\" }",
	},
	{
		id: "webhooks",
		name: "Outbound Webhooks",
		icon: Webhook,
		tagline: "Register HTTP endpoints for deposit, credit-low, request-failed events.",
		endpoint: "/v1/webhooks",
		method: "POST",
		status: "beta",
		description:
			"Register a URL to receive signed webhook deliveries for any of the supported event types. Deliveries include a signature header your endpoint must verify. Failed deliveries are retried up to 5 times with exponential backoff.",
		example: 'POST /v1/webhooks { "url": "https://...", "events": ["deposit.matched", "credit.low"] }',
	},
	{
		id: "mcp",
		name: "MCP Server (Model Context Protocol)",
		icon: Boxes,
		tagline: "Plug OMA into Claude, Cursor, or any MCP-aware agent host.",
		endpoint: "npx @oma-ai/mcp",
		method: "POST",
		status: "beta",
		description:
			"An MCP server that exposes OMA's catalog, models, and inference as MCP tools. Plug OMA into Claude Desktop, Cursor, or any MCP-aware agent and call models directly from the agent's tool palette. No API key wiring required — your existing OMA session is reused.",
		example: 'npx @oma-ai/mcp  # then "use oma_chat with model=claude-opus-4-8"',
	},
	{
		id: "agent-card",
		name: "Agent Card Discovery",
		icon: Fingerprint,
		tagline: "Discovery endpoint at the well-known URI for AI agent registries.",
		endpoint: "/.well-known/agent-card.json",
		method: "GET",
		status: "stable",
		description:
			"A standards-track agent card at /.well-known/agent-card.json that describes OMA as an addressable AI service. Compatible with agent registries that index by well-known URI.",
		example: 'GET /.well-known/agent-card.json → { "name": "OMA AI", "skills": [...], "auth": [...] }',
	},
];

// Status pills — solid backgrounds with high-contrast text for WCAG AA
// compliance (4.5:1). Earlier versions used 10-20% tinted fills that washed
// out on the void surface. Now we use solid hue fills with payload text.
const STATUS_STYLE: Record<
	Primitive["status"],
	{ bg: string; text: string; border: string; ring: string }
> = {
	stable: {
		bg: "bg-emerald-500",
		text: "text-void",
		border: "border-emerald-400",
		ring: "ring-emerald-500/40",
	},
	beta: {
		bg: "bg-amber-500",
		text: "text-void",
		border: "border-amber-400",
		ring: "ring-amber-500/40",
	},
	alpha: {
		bg: "bg-sky-500",
		text: "text-white",
		border: "border-sky-400",
		ring: "ring-sky-500/40",
	},
};

const METHOD_COLOR: Record<Primitive["method"], string> = {
	GET: "text-info",
	POST: "text-accent",
	WS: "text-violet",
};

const STATUS_DOT: Record<Primitive["status"], string> = {
	stable: "bg-success",
	beta: "bg-warning",
	alpha: "bg-info",
};

export default function NetworkPage() {
	return (
		<div className="min-h-dvh bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
			<FloatingIcons />
			{/* Background — animated grid mask for "infrastructure" feel */}
			<div
				aria-hidden="true"
				className="pointer-events-none fixed inset-0 -z-10 bg-grid mask-radial opacity-30"
			/>

			<div className="overflow-x-clip">
				<div className="flex flex-col">
					{/* ===== HERO ===== */}
					<section className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-12 sm:pb-16">
						<Link
							href="/"
							className="mb-6 inline-flex items-center gap-2 text-[12.5px] text-text-muted hover:text-accent transition-colors"
						>
							<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
							Back to home
						</Link>

						<div className="flex items-center gap-2 mb-5">
							<Network className="h-4 w-4 text-accent" aria-hidden="true" />
							<span className="text-xs uppercase tracking-[0.18em] font-mono text-accent">
								/network
							</span>
						</div>

						<h1
							className="h1-page text-text-bright break-words"
							style={{ textWrap: "balance" }}
						>
							<span className="block">Programmable network</span>
							<span className="block text-accent">primitives for agents.</span>
						</h1>

						<p className="mt-6 max-w-2xl text-[15px] sm:text-base text-text leading-relaxed">
							OMA exposes its infrastructure as composable APIs — the same way
							GSMA OpenGateway exposes carrier network functions to developers.
							Eight primitives today. Same OpenAI-compatible auth as the inference
							endpoint.
						</p>

						<div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl auto-rows-fr">
							{(() => {
								const counts = {
									total: PRIMITIVES.length,
									stable: PRIMITIVES.filter((p) => p.status === "stable").length,
									beta: PRIMITIVES.filter((p) => p.status === "beta").length,
									alpha: PRIMITIVES.filter((p) => p.status === "alpha").length,
								};
								const statCards = [
									{ label: "primitives", value: counts.total, color: "text-accent", dot: "bg-accent" },
									{ label: "stable", value: counts.stable, color: "text-success", dot: "bg-success" },
									{ label: "beta", value: counts.beta, color: "text-warning", dot: "bg-warning" },
									// Hide the alpha stat card entirely when zero — avoids the
									// confusing "0 alpha" state that previously looked like an error.
									...(counts.alpha > 0
										? [{ label: "alpha", value: counts.alpha, color: "text-info", dot: "bg-info" }]
										: []),
								];
								return statCards.map((stat) => (
									<div
										key={stat.label}
										className="flex h-full flex-col justify-between border border-border rounded-md p-3 bg-surface/50 transition-colors hover:border-border-hi"
									>
										<p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-text-muted">
											<span
												className={`h-1.5 w-1.5 rounded-full ${stat.dot}`}
												aria-hidden="true"
											/>
											{stat.label}
										</p>
										<p className={`mt-1.5 text-2xl font-display font-bold tabular-nums ${stat.color}`}>
											{stat.value}
										</p>
									</div>
								));
							})()}
						</div>
					</section>

					{/* ===== PRIMITIVES GRID ===== */}
					<section className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
						<header className="mb-8 max-w-2xl">
							<p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-3">
								Inventory
							</p>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
								Eight primitives
							</h2>
							<p className="mt-3 text-[14px] text-text-secondary leading-relaxed">
								Click any card to inspect the request shape, signing rules,
								and delivery semantics.
							</p>
						</header>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
							{PRIMITIVES.map((p, idx) => {
								const Icon = p.icon;
								const status = STATUS_STYLE[p.status];
								return (
									<article
										key={p.id}
										className="group relative cursor-pointer overflow-hidden rounded-lg border border-border bg-surface/40 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-surface-elevated/50 hover:shadow-[0_12px_28px_-18px_rgba(0,0,0,0.9)] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/40"
									>
										{/* Accent glow that breathes on hover */}
										<span
											aria-hidden="true"
											className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
										/>

										<header className="flex items-start gap-3 mb-3">
											<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-accent/35 bg-accent-dim transition-colors group-hover:border-accent/55 group-hover:bg-accent/15">
												<Icon
													className="h-4 w-4 text-accent transition-transform duration-300 group-hover:scale-110"
													aria-hidden="true"
												/>
											</div>
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2 flex-wrap">
													<h3 className="font-display text-[15px] font-semibold text-text-bright truncate">
														{p.name}
													</h3>
													{/* Status pill — solid fill for contrast, dot for redundancy */}
													<span
														className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider ${status.bg} ${status.text} ${status.border}`}
														aria-label={`Status: ${p.status}`}
													>
														<span
															className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[p.status]}`}
															aria-hidden="true"
														/>
														{p.status}
													</span>
												</div>
												<p className="mt-1 text-[11px] font-mono text-text-muted tabular-nums">
													<span
														className={`font-semibold ${METHOD_COLOR[p.method]}`}
													>
														{p.method}
													</span>
													<span className="mx-1.5 text-text-tertiary">·</span>
													<span className="break-all">{p.endpoint}</span>
												</p>
											</div>
											{/* Index badge — now visually anchored to the corner with consistent placement */}
											<span
												aria-hidden="true"
												className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-void/60 px-1 text-[10px] font-mono tabular-nums text-text-muted"
											>
												{String(idx + 1).padStart(2, "0")}
											</span>
										</header>

										<p className="text-[13px] text-text-secondary leading-relaxed mb-3">
											{p.tagline}
										</p>

										<details className="group/details border-t border-border pt-3">
											<summary className="cursor-pointer list-none text-[11px] font-mono uppercase tracking-wider text-text-secondary hover:text-accent transition-colors flex items-center gap-1.5 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm">
												<ArrowRight
													className="h-3 w-3 transition-transform duration-200 group-open/details:rotate-90"
													aria-hidden="true"
												/>
												<span>{p.name} details</span>
											</summary>
											<div className="mt-3 space-y-3">
												<p className="text-[12px] text-text-secondary leading-relaxed">
													{p.description}
												</p>
												{p.example && (
													<pre className="overflow-x-auto text-[11px] font-mono text-text-secondary bg-void-deep border border-border rounded-md px-3 py-2.5 leading-relaxed">
														<code>{p.example}</code>
													</pre>
												)}
											</div>
										</details>
									</article>
								);
							})}
						</div>
					</section>

					{/* ===== PROTOCOL ===== */}
					<section className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 border-t border-border">
						<header className="mb-8 max-w-2xl">
							<p className="text-xs font-mono uppercase tracking-widest text-text-muted mb-3">
								How it works
							</p>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
								One auth, eight surfaces
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								Every primitive accepts the same API key as the inference
								endpoint. Bearer token in, JSON out. WebSocket feeds use the
								same key in the connection query string.
							</p>
						</header>

						<div className="border border-border bg-surface/40 rounded-lg overflow-hidden">
							<div className="px-4 py-3 border-b border-border bg-surface flex items-center gap-2">
								<span
									className="h-2 w-2 rounded-full bg-error"
									aria-hidden="true"
								/>
								<span
									className="h-2 w-2 rounded-full bg-warning"
									aria-hidden="true"
								/>
								<span
									className="h-2 w-2 rounded-full bg-success"
									aria-hidden="true"
								/>
								<span className="ml-2 text-[11px] font-mono text-text-muted">
									terminal · $ oma network status
								</span>
							</div>
							<pre className="overflow-x-auto p-5 text-[12px] font-mono text-text-secondary leading-relaxed">
								<code>
									<span className="text-accent">$</span>{" "}
									<span className="text-text-bright">curl</span>{" "}
									<span className="text-info">-H</span>{" "}
									<span className="text-[var(--color-secondary)]">
										&quot;Authorization: Bearer $OMA_KEY&quot;
									</span>{" "}
									\{"\n"}
									{"    "}
									<span className="text-info">-H</span>{" "}
									<span className="text-[var(--color-secondary)]">
										&quot;Accept: application/json&quot;
									</span>{" "}
									\{"\n"}
									{"    "}
									<span className="text-accent">https://api.oma-ai.com/v1/upstream/health</span>
									{"\n\n"}
									<span className="text-text-muted">{"{"}</span>
									{"\n"}
									{"  "}
									<span className="text-accent">&quot;venice&quot;</span>
									<span className="text-text-muted">:</span>{" "}
									<span className="text-[var(--color-secondary)]">
										&quot;closed&quot;
									</span>
									<span className="text-text-muted">,</span>
									{"\n"}
									{"  "}
									<span className="text-accent">&quot;gonka&quot;</span>
									<span className="text-text-muted">:</span>{" "}
									<span className="text-[var(--color-secondary)]">
										&quot;closed&quot;
									</span>
									{"\n"}
									<span className="text-text-muted">{"}"}</span>
								</code>
							</pre>
						</div>
					</section>

					{/* ===== CTA ===== */}
					<section className="border-t border-border mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
						<div className="rounded-2xl border border-accent/30 bg-accent-dim px-6 sm:px-10 py-10 sm:py-14 relative overflow-hidden">
							<span
								aria-hidden="true"
								className="absolute left-0 top-0 bottom-0 w-1 bg-accent"
							/>
							<h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright max-w-xl">
								Wire OMA into your agent runtime
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary max-w-xl leading-relaxed">
								Full reference for every primitive, including auth, signing,
								rate limits, and webhook delivery guarantees.
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
											href="/docs"
											className="btn-primary inline-flex min-h-11 items-center gap-2 px-5"
										>
											Read the docs
											<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
										</Link>
									</ElectricBorder>
								</JuiceButton>
								<Link
									href="/observability"
									className="btn-secondary inline-flex min-h-11 items-center gap-2 px-5"
								>
									See live observability
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
