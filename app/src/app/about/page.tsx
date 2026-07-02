/* OMA · About page
 * conversational marketing layout · sections: hero · what · built with · how · team · reach
 * copy: active voice, no adverbs, no invented metrics
 */

import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	Github,
	Mail,
	Twitter,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusDot } from "@/components/ui/StatusDot";
import { MODEL_COUNT } from "@/lib/models-data";

export const metadata: Metadata = {
	title: "About · OMA",
	description: `OMA is a thin inference gateway. ${MODEL_COUNT}+ models, one OpenAI-compatible API, paid in USDC. No account, no card, no sales call.`,
	alternates: { canonical: "/about" },
	openGraph: {
		title: "About · OMA",
		description:
			"OMA is a thin inference gateway. One OpenAI-compatible endpoint, one price list, USDC on Base, wallet-only auth.",
			},
	twitter: {
		card: "summary_large_image",
		title: "About · OMA",
		description:
			"OMA is a thin inference gateway. One API, USDC on Base, wallet-only auth.",
	},
};

const STACK_LINKS = [
	{ name: "Next.js 15", note: "App router · React server components" },
	{ name: "Tailwind 4", note: "Utility-first CSS · design system" },
	{ name: "Hono", note: "Edge API gateway · OpenAI-compatible" },
	{ name: "Drizzle + Neon", note: "Postgres · credits ledger" },
	{ name: "wagmi + viem", note: "EVM wallet stack · SIWE auth" },
	{ name: "x402 protocol", note: "Per-request USDC settlement" },
	{ name: "Base", note: "USDC receipt · EIP-3009 transferWithAuthorization" },
	{ name: "Houdini Swap", note: "Cross-chain deposit routing" },
	{ name: "Venice", note: "Upstream inference provider" },
] as const;

const ENDPOINT_FLOW = [
	{
		idx: "01",
		client: "curl / OpenAI SDK",
		server: "POST /v1/chat/completions",
		note: "Authenticated request, OpenAI-compatible body",
	},
	{
		idx: "02",
		client: "wallet · SIWE",
		server: "POST /v1/auth/verify",
		note: "Bearer token attached via oma_session cookie",
	},
	{
		idx: "03",
		client: "credit preflight",
		server: "internal · credit-preflight.ts",
		note: "Estimates cost · rejects if balance too low",
	},
	{
		idx: "04",
		client: "provider routing",
		server: "internal · router.ts",
		note: "Failover circuit breaker across Venice / AntSeed",
	},
	{
		idx: "05",
		client: "usage deduction",
		server: "POST /v1/usage",
		note: "Deducts credits · records prompt / completion tokens",
	},
	{
		idx: "06",
		client: "x402 verify",
		server: "POST /x402/verify",
		note: "EIP-3009 signature check · 402 if no payment header",
	},
] as const;

const ISSUED = "2026-06-12";

const STACK = [
	{
		idx: "01",
		actor: "USER",
		role: "Caller",
		note: "OpenAI-compatible HTTP client",
	},
	{
		idx: "02",
		actor: "OMA",
		role: "Gateway",
		note: "Auth, metering, routing, x402",
	},
	{
		idx: "03",
		actor: "CHEAP",
		role: "Sourcing",
		note: "Daily-discounted Venice reseller",
	},
	{
		idx: "04",
		actor: "SURPLUS",
		role: "Backup",
		note: "Operator-side procurement, off the hot path",
	},
	{
		idx: "05",
		actor: "VENICE",
		role: "Compute",
		note: "Model host · API · billing",
	},
	{ idx: "06", actor: "BASE", role: "Settle", note: "USDC receipt · EIP-3009" },
] as const;

const PILLARS = [
	{
		idx: "01",
		title: "What OMA is",
		body: "A thin gateway over upstream model providers. OMA does not train, host, or fine-tune models. Every request is forwarded to a model host, metered at the token, and billed to a wallet.",
	},
	{
		idx: "02",
		title: "How it works",
		body: "You send a request to an OpenAI-compatible endpoint. OMA authenticates your wallet, debits credits, and routes to Venice through a pool of leased keys purchased on the secondary market. Settlement happens on Base.",
	},
	{
		idx: "03",
		title: "Why it exists",
		body: "To make inference permissionless. No sales funnel, no enterprise contract, no email gate. The same API works from a laptop in Montreal and a CI job in São Paulo.",
	},
	{
		idx: "04",
		title: "What it costs",
		body: "A flat 25% markup over Venice retail. The procurement math is internal; the user-facing price list is the same number for every call, regardless of what OMA actually paid.",
	},
] as const;

export default function AboutPage() {
	return (
		<div className="min-h-screen bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
			<div className="overflow-x-clip">
				<div className="flex flex-col">
					{/* ===== HERO ===== */}
					<section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-24 sm:pb-32">
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
									<span
										className="h-1.5 w-1.5 rounded-full bg-accent"
										aria-hidden="true"
									/>
									About OMA
								</span>

								<h1
									className="h1-page text-text-bright mt-6"
									style={{
										overflowWrap: "anywhere",
										minWidth: 0,
										textWrap: "balance",
									}}
								>
									<span className="block">We built OMA because</span>
									<span className="block text-accent">
										AI shouldn&apos;t require an account.
									</span>
								</h1>

								<p
									className="mt-6 max-w-2xl text-[15px] sm:text-base text-text leading-relaxed"
									style={{ textWrap: "pretty" }}
								>
									OMA is a thin gateway between your code and an upstream model
									provider. You sign in with a wallet, pay per request in USDC,
									and get an OpenAI-compatible endpoint in return. We never see
									your prompts and we don&apos;t ask for an email.
								</p>

								<p className="mt-4 max-w-2xl text-[14px] sm:text-[15px] text-text-secondary leading-relaxed">
									The model still runs on infrastructure we don&apos;t own. We
									authenticate with your wallet, meter tokens, settle on Base,
									and forward the call. That&apos;s the whole product.
								</p>

								<div className="mt-8 flex flex-wrap items-center gap-3">
									<Link
										href="/docs"
										className="bg-accent text-void hover:bg-accent-hover px-5 py-2.5 rounded-2xl font-medium transition-colors"
									>
										<span aria-hidden="true" className="text-text-inverse">
											›
										</span>
										Read the docs
									</Link>
									<Link
										href="/pricing"
										className="bg-surface text-text border border-border hover:bg-surface-elevated px-5 py-2.5 rounded-2xl font-medium transition-colors"
									>
										See pricing
									</Link>
								</div>
							</div>

							<aside
								aria-label="At a glance"
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
									<span className="flex items-center gap-1.5 text-[11px] text-accent">
										<StatusDot />
										<span className="sr-only">Status: </span>current
									</span>
								</div>
								<dl className="text-[12px]">
									{[
										["Form", "Inference gateway"],
										["Hosts", "0 (we forward)"],
										["Models", `${MODEL_COUNT} across providers`],
										["Auth", "Wallet · SIWE"],
										["Settlement", "USDC · Base"],
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
									Last updated · {ISSUED}
								</div>
							</aside>
						</div>
					</section>

					{/* ===== WHAT ===== */}
					<section
						id="what"
						aria-labelledby="what-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 scroll-reveal"
					>
						<header className="mb-8 sm:mb-10 max-w-2xl">
							<h2
								id="what-heading"
								className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright"
							>
								The short version
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								Four things you need to know to understand what OMA is and why
								it exists.
							</p>
						</header>

						<ul className="grid gap-3 sm:gap-4 sm:grid-cols-2 list-none p-0">
							{PILLARS.map((p) => (
								<li
									key={p.idx}
									className="group border border-border bg-surface p-5 sm:p-6 rounded-xl hover:border-accent/40 transition-colors"
								>
									<div className="mb-3 flex items-center gap-3">
										<span className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/20 bg-accent/5 text-[11px] font-semibold text-accent">
											{p.idx}
										</span>
										<h3 className="font-display text-[15px] sm:text-base font-semibold text-text-bright">
											{p.title}
										</h3>
									</div>
									<p className="text-[13px] sm:text-[14px] text-text-secondary leading-relaxed">
										{p.body}
									</p>
								</li>
							))}
						</ul>
					</section>

					{/* ===== BUILT WITH ===== */}
					<section
						id="built-with"
						aria-labelledby="built-with-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 scroll-reveal"
					>
						<header className="mb-8 sm:mb-10 max-w-2xl">
							<h2
								id="built-with-heading"
								className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright"
							>
								Built with
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								The actual stack. No marketing whitepaper, just the libraries
								and services in production today.
							</p>
						</header>
						<ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 list-none p-0">
							{STACK_LINKS.map((s) => (
								<li
									key={s.name}
									className="border border-border bg-surface px-3 py-2.5 rounded-lg"
								>
									<p className="text-[13px] font-semibold text-text-bright truncate">
										{s.name}
									</p>
									<p className="text-[11px] text-text-muted truncate">
										{s.note}
									</p>
								</li>
							))}
						</ul>
						<p className="mt-4 text-[12.5px] sm:text-[13px] text-text-muted">
							The server source lives in{" "}
							<code className="text-text-bright">server/src/</code>; the
							gateway, the credit engine, and the x402 facilitator are all in
							the same monorepo.
						</p>
					</section>

					{/* ===== HOW (endpoint flow) ===== */}
					<section
						id="how"
						aria-labelledby="how-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 scroll-reveal"
					>
						<header className="mb-8 sm:mb-10 max-w-2xl">
							<h2
								id="how-heading"
								className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright"
							>
								How a request works
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								One call crosses six actors. You only see OMA. The model only
								sees OMA. Settlement is the only public surface.
							</p>
						</header>

						<div className="border border-border bg-surface p-4 sm:p-6 min-w-0">
							<svg
								viewBox="0 0 600 360"
								role="img"
								aria-label="OMA request path. User sends an OpenAI-compatible request to OMA. OMA authenticates the wallet, debits credits, and forwards to a Venice key leased from CheapTokens. Surplus Intelligence is reserved as an operator-side backup. Venice serves the call. USDC settles on Base."
								className="w-full h-auto"
								preserveAspectRatio="xMidYMid meet"
							>
								<title>OMA request path</title>
								<desc>
									Six actors on the request path: User, OMA, CheapTokens,
									Surplus, Venice, Base. Arrows show request flow and settlement
									flow. Operator-internal links (OMA to CheapTokens, OMA to
									Surplus) are dashed; user-facing links (User to OMA, OMA to
									Venice, OMA to Base) are solid.
								</desc>

								<defs>
									<marker
										id="aboutArrow"
										viewBox="0 0 10 10"
										refX="9"
										refY="5"
										markerWidth="6"
										markerHeight="6"
										orient="auto-start-reverse"
									>
										<path
											d="M 0 0 L 10 5 L 0 10 z"
											fill="var(--color-text-tertiary)"
										/>
									</marker>
									<marker
										id="aboutArrowAccent"
										viewBox="0 0 10 10"
										refX="9"
										refY="5"
										markerWidth="6"
										markerHeight="6"
										orient="auto-start-reverse"
									>
										<path
											d="M 0 0 L 10 5 L 0 10 z"
											fill="var(--color-accent)"
										/>
									</marker>
								</defs>

								{/* Column labels */}
								<text
									x="60"
									y="20"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
									letterSpacing="0.1em"
								>
									CALLER
								</text>
								<text
									x="300"
									y="20"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-accent)"
									letterSpacing="0.1em"
								>
									OMA
								</text>
								<text
									x="540"
									y="20"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
									letterSpacing="0.1em"
								>
									UPSTREAM
								</text>

								{/* Vertical swimlanes */}
								<line
									x1="120"
									y1="30"
									x2="120"
									y2="340"
									stroke="var(--color-border)"
									strokeWidth="1"
									strokeDasharray="2 4"
								/>
								<line
									x1="480"
									y1="30"
									x2="480"
									y2="340"
									stroke="var(--color-border)"
									strokeWidth="1"
									strokeDasharray="2 4"
								/>

								{/* USER box */}
								<rect
									x="20"
									y="40"
									width="80"
									height="36"
									fill="var(--color-surface-elevated)"
									stroke="var(--color-border)"
								/>
								<text
									x="60"
									y="55"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-bright)"
								>
									USER
								</text>
								<text
									x="60"
									y="68"
									textAnchor="middle"
									fontSize="9"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									HTTP client
								</text>

								{/* OMA box */}
								<rect
									x="260"
									y="40"
									width="80"
									height="36"
									fill="var(--color-accent-dim)"
									stroke="var(--color-accent)"
								/>
								<text
									x="300"
									y="55"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-accent)"
								>
									OMA
								</text>
								<text
									x="300"
									y="68"
									textAnchor="middle"
									fontSize="9"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									gateway
								</text>

								{/* VENICE box */}
								<rect
									x="500"
									y="40"
									width="80"
									height="36"
									fill="var(--color-surface-elevated)"
									stroke="var(--color-border)"
								/>
								<text
									x="540"
									y="55"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-bright)"
								>
									VENICE
								</text>
								<text
									x="540"
									y="68"
									textAnchor="middle"
									fontSize="9"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									model host
								</text>

								{/* CHEAPTOKENS box */}
								<rect
									x="500"
									y="160"
									width="80"
									height="36"
									fill="var(--color-surface-elevated)"
									stroke="var(--color-border)"
								/>
								<text
									x="540"
									y="175"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-bright)"
								>
									CHEAP
								</text>
								<text
									x="540"
									y="188"
									textAnchor="middle"
									fontSize="9"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									key vendor
								</text>

								{/* SURPLUS box */}
								<rect
									x="500"
									y="230"
									width="80"
									height="36"
									fill="var(--color-surface-elevated)"
									stroke="var(--color-border)"
								/>
								<text
									x="540"
									y="245"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-bright)"
								>
									SURPLUS
								</text>
								<text
									x="540"
									y="258"
									textAnchor="middle"
									fontSize="9"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									backup
								</text>

								{/* BASE box */}
								<rect
									x="260"
									y="300"
									width="80"
									height="36"
									fill="var(--color-surface-elevated)"
									stroke="var(--color-border)"
								/>
								<text
									x="300"
									y="315"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-bright)"
								>
									BASE
								</text>
								<text
									x="300"
									y="328"
									textAnchor="middle"
									fontSize="9"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									USDC settle
								</text>

								{/* Step 1: USER -> OMA (request, solid) */}
								<text
									x="6"
									y="104"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									01
								</text>
								<line
									x1="100"
									y1="100"
									x2="260"
									y2="100"
									stroke="var(--color-accent)"
									strokeWidth="1.25"
									markerEnd="url(#aboutArrowAccent)"
								/>
								<text
									x="180"
									y="94"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-accent)"
								>
									request
								</text>

								{/* Step 2: OMA -> VENICE (forward, solid) */}
								<text
									x="6"
									y="134"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									02
								</text>
								<line
									x1="340"
									y1="100"
									x2="500"
									y2="100"
									stroke="var(--color-text-tertiary)"
									strokeWidth="1.25"
									markerEnd="url(#aboutArrow)"
								/>
								<text
									x="420"
									y="94"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-secondary)"
								>
									forward
								</text>

								{/* Step 3: OMA -> CHEAPTOKENS (operator-internal, dashed) */}
								<text
									x="6"
									y="184"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									03
								</text>
								<line
									x1="340"
									y1="180"
									x2="500"
									y2="180"
									stroke="var(--color-text-tertiary)"
									strokeWidth="1"
									strokeDasharray="3 3"
									markerEnd="url(#aboutArrow)"
								/>
								<text
									x="420"
									y="174"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									lease keys
								</text>

								{/* Step 4: OMA -> SURPLUS (operator-internal, dashed) */}
								<text
									x="6"
									y="254"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									04
								</text>
								<line
									x1="340"
									y1="250"
									x2="500"
									y2="250"
									stroke="var(--color-text-tertiary)"
									strokeWidth="1"
									strokeDasharray="3 3"
									markerEnd="url(#aboutArrow)"
								/>
								<text
									x="420"
									y="244"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									backup
								</text>

								{/* Step 5: OMA -> BASE (settlement, solid) */}
								<text
									x="6"
									y="324"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-text-tertiary)"
								>
									05
								</text>
								<line
									x1="540"
									y1="240"
									x2="540"
									y2="60"
									stroke="var(--color-text-tertiary)"
									strokeWidth="0"
								/>
								<line
									x1="340"
									y1="320"
									x2="540"
									y2="320"
									stroke="var(--color-accent)"
									strokeWidth="1.25"
									strokeDasharray="0"
									markerEnd="url(#aboutArrowAccent)"
								/>
								<text
									x="420"
									y="314"
									textAnchor="middle"
									fontSize="10"
									fontFamily="var(--font-mono)"
									fill="var(--color-accent)"
								>
									settle USDC
								</text>
							</svg>
						</div>

						<ol className="mt-6 border border-border bg-surface divide-y divide-border rounded-xl overflow-hidden">
							{STACK.map((s) => (
								<li
									key={s.idx}
									className="grid grid-cols-[2.5rem_4.5rem_minmax(0,1fr)] sm:grid-cols-[2.75rem_6rem_minmax(0,1fr)] items-center gap-3 px-3 sm:px-4 py-2.5"
								>
									<span className="text-[11px] text-text-muted tabular-nums">
										{s.idx}
									</span>
									<span
										className={`text-[11px] font-semibold ${
											s.actor === "CHEAP"
												? "text-secondary"
												: s.actor === "VENICE"
													? "text-violet"
													: s.actor === "BASE"
														? "text-accent"
														: s.actor === "USER"
															? "text-text-bright"
															: "text-text-tertiary"
										}`}
									>
										{s.actor}
									</span>
									<span className="text-[13px] text-text-bright truncate">
										<span className="text-text-muted mr-2">{s.role}</span>
										{s.note}
									</span>
								</li>
							))}
						</ol>

						<div className="mt-8 border border-border bg-surface p-4 sm:p-5 rounded-xl">
							<p className="text-[12px] font-semibold text-text-bright mb-3">
								Endpoint flow
							</p>
							<p className="text-[12px] text-text-muted mb-4">
								What each leg of the request path actually calls.
							</p>
							<ol className="divide-y divide-border">
								{ENDPOINT_FLOW.map((e) => (
									<li
										key={e.idx}
										className="grid grid-cols-[2.25rem_minmax(0,1fr)] sm:grid-cols-[2.5rem_minmax(0,11rem)_minmax(0,18rem)_minmax(0,1fr)] items-start gap-2 sm:gap-3 py-2.5"
									>
										<span className="text-[11px] text-text-muted tabular-nums">
											{e.idx}
										</span>
										<span className="text-[12.5px] text-text-secondary truncate">
											{e.client}
										</span>
										<code className="text-[12px] text-accent font-mono truncate">
											{e.server}
										</code>
										<span className="hidden sm:inline text-[11.5px] text-text-muted">
											{e.note}
										</span>
									</li>
								))}
							</ol>
						</div>
					</section>

					{/* ===== TEAM ===== */}
					<section
						id="team"
						aria-labelledby="team-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 scroll-reveal"
					>
						<header className="mb-8 sm:mb-10 max-w-2xl">
							<h2
								id="team-heading"
								className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright"
							>
								Who runs OMA
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								A small operator team. The procurement loop, the x402
								facilitator, and the rate-limit policy are all in the source.
							</p>
						</header>

						<div className="border border-border bg-surface p-5 sm:p-7 relative overflow-hidden rounded-xl">
							<span
								aria-hidden="true"
								className="absolute left-0 top-0 bottom-0 w-1 bg-accent"
							/>
							<p className="text-[14px] sm:text-base text-text-secondary max-w-2xl leading-relaxed">
								OMA is run by a small operator team. The procurement loop, the
								x402 facilitator, and the rate-limit policy are documented in
								the source. There is no corporation, no board, and no marketing
								department. The build artifacts and the docs are the product.
							</p>
							<dl className="mt-6 grid gap-3 sm:grid-cols-3 text-[12px]">
								{[
									["Role", "Operator · engineer"],
									["Reach", "github · x · email"],
									["Disclosure", "source-available"],
								].map(([k, v]) => (
									<div
										key={k}
										className="grid grid-cols-2 gap-2 border border-border bg-panel px-3 py-2 rounded-lg"
									>
										<dt className="text-text-muted text-[11.5px]">{k}</dt>
										<dd className="text-text-secondary truncate text-right">
											{v}
										</dd>
									</div>
								))}
							</dl>
						</div>
					</section>

					{/* ===== REACH ===== */}
					<section
						id="links"
						aria-labelledby="links-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 scroll-reveal"
					>
						<header className="mb-8 sm:mb-10 max-w-2xl">
							<h2
								id="links-heading"
								className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-text-bright"
							>
								Find us
							</h2>
							<p className="mt-3 text-[14px] sm:text-base text-text-secondary leading-relaxed">
								GitHub for code, X for updates, email for everything else.
							</p>
						</header>

						<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
							<a
								href="https://github.com/oma-ai"
								target="_blank"
								rel="noopener noreferrer"
								className="group flex items-center justify-between gap-3 border border-border bg-surface p-4 transition-colors hover:border-accent/40"
							>
								<div className="flex items-center gap-3 min-w-0">
									<Github
										className="h-5 w-5 text-accent shrink-0"
										aria-hidden="true"
									/>
									<div className="min-w-0">
										<p className="text-[13px] font-semibold text-text-bright truncate">
											GitHub
										</p>
										<p className="text-[11px] text-text-muted font-mono truncate">
											@oma-ai
										</p>
									</div>
								</div>
								<ArrowRight
									className="h-4 w-4 text-text-muted group-hover:text-accent transition-colors"
									aria-hidden="true"
								/>
							</a>
							<a
								href="https://twitter.com/oma_ai"
								target="_blank"
								rel="noopener noreferrer"
								className="group flex items-center justify-between gap-3 border border-border bg-surface p-4 transition-colors hover:border-accent/40"
							>
								<div className="flex items-center gap-3 min-w-0">
									<Twitter
										className="h-5 w-5 text-accent shrink-0"
										aria-hidden="true"
									/>
									<div className="min-w-0">
										<p className="text-[13px] font-semibold text-text-bright truncate">
											X / Twitter
										</p>
										<p className="text-[11px] text-text-muted font-mono truncate">
											@oma_ai
										</p>
									</div>
								</div>
								<ArrowRight
									className="h-4 w-4 text-text-muted group-hover:text-accent transition-colors"
									aria-hidden="true"
								/>
							</a>
							<a
								href="mailto:hello@oma-ai.com"
								className="group flex items-center justify-between gap-3 border border-border bg-surface p-4 transition-colors hover:border-accent/40"
							>
								<div className="flex items-center gap-3 min-w-0">
									<Mail
										className="h-5 w-5 text-accent shrink-0"
										aria-hidden="true"
									/>
									<div className="min-w-0">
										<p className="text-[13px] font-semibold text-text-bright truncate">
											Email
										</p>
										<p className="text-[11px] text-text-muted font-mono truncate">
											hello@oma-ai.com
										</p>
									</div>
								</div>
								<ArrowRight
									className="h-4 w-4 text-text-muted group-hover:text-accent transition-colors"
									aria-hidden="true"
								/>
							</a>
						</div>

						<div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
							<Link
								href="/docs"
								className="group flex items-center justify-between gap-3 border border-accent/30 bg-accent-dim p-5 transition-colors hover:border-accent/60"
							>
								<div className="flex items-center gap-3 min-w-0">
									<BookOpen
										className="h-5 w-5 text-accent shrink-0"
										aria-hidden="true"
									/>
									<div className="min-w-0">
										<p className="text-[13px] font-semibold text-text-bright truncate">
											Read the docs
										</p>
										<p className="text-[11px] text-text-muted truncate">
											API reference, examples, integrations.
										</p>
									</div>
								</div>
								<ArrowRight
									className="h-4 w-4 text-accent transition-transform group-hover:translate-x-0.5"
									aria-hidden="true"
								/>
							</Link>
							<Link
								href="/pricing"
								className="group flex items-center justify-between gap-3 border border-accent/30 bg-accent-soft p-5 transition-colors hover:border-accent/60"
							>
								<div className="flex items-center gap-3 min-w-0">
									<ArrowRight
										className="h-5 w-5 text-accent shrink-0"
										aria-hidden="true"
									/>
									<div className="min-w-0">
										<p className="text-[13px] font-semibold text-text-bright truncate">
											See pricing
										</p>
										<p className="text-[11px] text-text-muted truncate">
											Per-model rates, payment methods.
										</p>
									</div>
								</div>
								<ArrowRight
									className="h-4 w-4 text-accent transition-transform group-hover:translate-x-0.5"
									aria-hidden="true"
								/>
							</Link>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
