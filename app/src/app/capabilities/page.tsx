import type { Metadata } from "next";
import Link from "next/link";
import {
	ArrowRight,
	Bot,
	Coins,
	CreditCard,
	Image as ImageIcon,
	KeyRound,
	Sparkles,
	Type as TypeIcon,
	Video,
} from "lucide-react";
import { MODEL_COUNT } from "@/lib/models-data";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import { InViewFade } from "@/components/motion/in-view-fade";

export const metadata: Metadata = {
	title: "Capabilities — every model, every rail, one endpoint",
	description: `Every capability OMA exposes in one place: chat, image, video, x402 pay-per-request, A2UI, A2A discovery. ${MODEL_COUNT}+ models behind one OpenAI-compatible API.`,
	alternates: { canonical: "/capabilities" },
	openGraph: {
		title: "OMA — Capabilities",
		description: "One gateway. Every model. Every rail. Chat, image, video, x402, A2UI — all OpenAI-compatible.",
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA Capabilities" }],
	},
	robots: { index: true, follow: true },
};

const MODALITIES: Array<{
	id: string;
	name: string;
	icon: typeof TypeIcon;
	tag: string;
	endpoint: string;
	pricing: string;
	description: string;
	example: { request: string; response: string };
}> = [
	{
		id: "chat",
		name: "Chat Completions",
		icon: TypeIcon,
		tag: "/v1/chat/completions",
		endpoint: "POST https://api.oma-ai.com/v1/chat/completions",
		pricing: "From $0.015 / 1M input tokens",
		description:
			"OpenAI-compatible chat. Streaming, tool/function calling, system prompts, JSON mode, vision, multi-modal. Works with the official openai-python, openai-node, Vercel AI SDK, LangChain, and any other client.",
		example: {
			request: `curl https://api.oma-ai.com/v1/chat/completions \\
 -H "Authorization: Bearer $OMA_KEY" \\
 -H "Content-Type: application/json" \\
 -d '{ "model": "llama-3.3-70b",
 "messages": [{"role":"user","content":"hi"}] }'`,
			response: `{
 "choices": [
 { "message": { "role": "assistant",
 "content": "Hey — welcome to OMA." } }
 ]
}`,
		},
	},
	{
		id: "image",
		name: "Image Generation",
		icon: ImageIcon,
		tag: "/v1/images/generations",
		endpoint: "POST https://api.oma-ai.com/v1/images/generations",
		pricing: "$0.10 per image",
		description:
			"Text-to-image via Venice. OpenAI-compatible response shape. Returns hosted URLs you can embed directly.",
		example: {
			request: `curl .../v1/images/generations \\
 -d '{ "model": "flux-2-pro",
 "prompt": "a red cube on a white table" }'`,
			response: `{
 "data": [
 { "url": "https://cdn.venice.ai/img/abc.png" }
 ]
}`,
		},
	},
	{
		id: "video",
		name: "Video Generation",
		icon: Video,
		tag: "/v1/videos/generations",
		endpoint: "POST https://api.oma-ai.com/v1/videos/generations",
		pricing: "$0.92 per generation",
		description:
			"Async text-to-video and image-to-video. Returns a queue id; poll /v1/videos/retrieve for the final URL. Generous 720p/1080p support across 5s–8s durations.",
		example: {
			request: `curl .../v1/videos/generations \\
 -d '{ "model": "kling-v3-pro-text-to-video",
 "prompt": "a wave crashing on a beach" }'`,
			response: `{
 "id": "vid_q_123",
 "status": "queued",
 "queue_id": "q_123"
}`,
		},
	},
];

const PAYMENT_RAILS: Array<{
	id: string;
	name: string;
	icon: typeof CreditCard;
	eyebrow: string;
	body: string;
	cta: { label: string; href: string };
	highlights: string[];
}> = [
	{
		id: "card",
		name: "Card credits ()",
		icon: CreditCard,
		eyebrow: "Easiest",
		body: "Buy credits with Visa, Mastercard, or Apple Pay. Powered by  — your card never touches OMA. Three plans: Hobby $10 / Builder $50 / Scale $250.",
		cta: { label: "Buy credits", href: "/deposit?method=card" },
		highlights: ["No wallet", "Apple Pay", "Instant settlement", "Powered by "],
	},
	{
		id: "usdc",
		name: "USDC on Base",
		icon: Coins,
		eyebrow: "Crypto-native",
		body: "Direct USDC deposits at 1:1 USD. Each credit on the ledger is backed by a real USDC on Base — you can verify the on-chain treasury yourself.",
		cta: { label: "Deposit USDC", href: "/deposit" },
		highlights: ["1:1 USD", "On-chain ledger", "Direct USDC on Base"],
	},
	{
		id: "x402",
		name: "x402 Pay-Per-Request (agents)",
		icon: Bot,
		eyebrow: "For agents",
		body: "An agent hits any endpoint without an API key. The gateway replies HTTP 402 with a PAYMENT-REQUIRED challenge. The agent signs a gasless EIP-3009 USDC transfer on Base and retries with PAYMENT-SIGNATURE.",
		cta: { label: "Read the spec", href: "/docs#x402" },
		highlights: ["Gasless EIP-3009", "Per-request pricing", "No account", "No API key"],
	},
];

const PROTOCOLS: Array<{ name: string; desc: string; href: string }> = [
	{
		name: "OpenAI-compatible",
		desc: "Same wire format as OpenAI's API. Drop-in for the official SDKs, Vercel AI SDK, LangChain, raw fetch.",
		href: "/docs#quickstart",
	},
	{
		name: "Anthropic-compatible",
		desc: "/v1/messages endpoint for Claude-ecosystem tooling and Claude Code.",
		href: "/docs",
	},
	{
		name: "A2A (Agent-to-Agent)",
		desc: "Publishes /.well-known/agent-card.json with skills, payment, and auth so other agents can discover and call OMA.",
		href: "/.well-known/agent-card.json",
	},
	{
		name: "A2UI v0.9.1",
		desc: "Models can render interactive UI (buttons, forms, cards) inside the playground chat instead of plain markdown.",
		href: "/chat",
	},
	{
		name: "Web search (DuckDuckGo)",
		desc: "Playground WEB mode grounds answers with live DuckDuckGo results via GET /v1/search — no extra API key.",
		href: "/chat",
	},
	{
		name: "x402",
		desc: "Native HTTP 402 payment protocol on Base. Agents can pay per call in USDC without a pre-funded account.",
		href: "/docs#x402",
	},
];

export default function CapabilitiesPage() {
	return (
		<div className="relative min-h-screen bg-void text-text overflow-x-clip">
			<BreadcrumbListJsonLd
				items={[
					{ name: "Home", url: "/" },
					{ name: "Capabilities", url: "/capabilities" },
				]}
			/>
			<div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
				<div className="absolute inset-0 bg-grid opacity-[0.3] mask-radial" />
			</div>

			<div className="container-page py-12 sm:py-16">
				<InViewFade>
					<p className="page-kicker">Capabilities</p>
					<h1 className="h1-page mt-4 text-text-bright">
						Every model. Every rail.{""}
						<span className="text-accent italic-accent">One endpoint.</span>
					</h1>
					<p className="page-intro mt-5 max-w-3xl">
						Chat, image, video, x402, A2UI — all behind one
						OpenAI-compatible API. {MODEL_COUNT}+ models across frontier,
						premium, mid-range, and budget tiers. Pick the rail that fits your
						stack; we handle the rest.
					</p>
				</InViewFade>

				<InViewFade delay={0.05}>
					<div className="mt-6 flex flex-wrap items-center gap-3">
						<Link
							href="/chat"
							className="btn-primary inline-flex h-11 items-center gap-2 px-5 text-sm"
						>
							<Sparkles className="h-4 w-4" aria-hidden="true" />
							Try chat (free)
						</Link>
						<Link
							href="/login"
							className="btn-secondary inline-flex h-11 items-center gap-2 px-5 text-sm"
						>
							<KeyRound className="h-4 w-4" aria-hidden="true" />
							Get an API key
						</Link>
						<Link
							href="/docs"
							className="btn-ghost inline-flex h-11 items-center gap-2 px-3 text-sm"
						>
							API reference
							<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
						</Link>
					</div>
				</InViewFade>

				{/* MODALITIES */}
				<section className="mt-20" aria-labelledby="modalities-headline">
					<InViewFade>
						<p className="page-kicker">Modalities</p>
						<h2 id="modalities-headline" className="h2-section mt-3 text-text-bright">
							Three modalities, one auth header.
						</h2>
						<p className="mt-3 max-w-2xl text-text-secondary">
							Each one speaks the OpenAI wire format, so the same{""}
							<code className="rounded-[var(--radius-sm)] bg-surface px-1.5 py-0.5 font-mono text-[12px] text-accent">
								Authorization: Bearer $OMA_KEY
							</code>{""}
							works everywhere.
						</p>
					</InViewFade>

					<div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
						{MODALITIES.map((m, i) => {
							const Icon = m.icon;
							return (
								<InViewFade key={m.id} delay={0.04 + i * 0.05}>
									<article className="group flex h-full flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface/60 p-5 transition-[color,border-color,background-color,transform] duration-200 ease-out hover:border-accent/40 active:scale-[0.98]">
										<div className="flex items-center justify-between">
											<span className="flex h-9 w-9 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
												<Icon className="h-4 w-4" aria-hidden="true" />
											</span>
											<span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
												{m.tag}
											</span>
										</div>
										<h3 className="text-base font-semibold text-text-bright">{m.name}</h3>
										<p className="text-[13px] leading-relaxed text-text-secondary">
											{m.description}
										</p>
										<div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono">
											<span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent">
												{m.pricing}
											</span>
										</div>
										<details className="group/d mt-2 rounded-md border border-border/60 bg-void/40">
											<summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted [&::-webkit-details-marker]:hidden">
												<span>Example</span>
												<span
													className="text-text-muted transition-transform duration-200 ease-out group-open/d:rotate-45"
													aria-hidden="true"
												>
													+
												</span>
											</summary>
											<div className="space-y-2 px-3 pb-3 pt-1 font-mono text-[10.5px] leading-relaxed text-text-secondary">													<pre tabIndex={0} aria-label={`${m.name} request example`} className="overflow-x-auto whitespace-pre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">

													<code>{m.example.request}</code>
												</pre>													<pre tabIndex={0} aria-label={`${m.name} response example`} className="overflow-x-auto whitespace-pre text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">

													<code>{m.example.response}</code>
												</pre>
											</div>
										</details>
									</article>
								</InViewFade>
							);
						})}
					</div>
				</section>

				{/* PAYMENT RAILS */}
				<section className="mt-24" aria-labelledby="rails-headline">
					<InViewFade>
						<p className="page-kicker">Payment rails</p>
						<h2 id="rails-headline" className="h2-section mt-3 text-text-bright">
							Pay your way.
						</h2>
						<p className="mt-3 max-w-2xl text-text-secondary">
							Card, USDC, or x402. The same credits balance the same requests.
							1 credit = $0.01 USD (so $1 = 100 credits), and every request
							deducts the model&apos;s per-token cost in credits at request time.
						</p>
					</InViewFade>

					<div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
						{PAYMENT_RAILS.map((r, i) => {
							const Icon = r.icon;
							return (
								<InViewFade key={r.id} delay={0.04 + i * 0.05}>
									<article className="flex h-full flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-surface/60 p-5 transition-[color,border-color,background-color,transform] duration-200 ease-out hover:border-accent/40 active:scale-[0.98]">
										<div className="flex items-center justify-between">
											<span className="flex h-9 w-9 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
												<Icon className="h-4 w-4" aria-hidden="true" />
											</span>
											<span className="rounded-full border border-border bg-void/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
												{r.eyebrow}
											</span>
										</div>
										<h3 className="text-base font-semibold text-text-bright">{r.name}</h3>
										<p className="text-[13px] leading-relaxed text-text-secondary">
											{r.body}
										</p>
										<ul className="space-y-1.5 text-[12.5px] text-text-secondary">
											{r.highlights.map((h) => (
												<li key={h} className="flex items-center gap-2">
													<span className="h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
													{h}
												</li>
											))}
										</ul>
										<Link
											href={r.cta.href}
											className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-hover"
										>
											{r.cta.label}
											<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
										</Link>
									</article>
								</InViewFade>
							);
						})}
					</div>
				</section>

				{/* PROTOCOLS */}
				<section className="mt-24" aria-labelledby="protocols-headline">
					<InViewFade>
						<p className="page-kicker">Protocols</p>
						<h2 id="protocols-headline" className="h2-section mt-3 text-text-bright">
							Speak the languages agents already use.
						</h2>
					</InViewFade>

					<div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{PROTOCOLS.map((p, i) => (
							<InViewFade key={p.name} delay={0.04 + i * 0.05}>
								<Link
									href={p.href}
									className="group flex h-full flex-col gap-2 rounded-[var(--radius-lg)] border border-border bg-surface/40 p-4 transition-[color,border-color,background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
								>
									<div className="flex items-center justify-between">
										<span className="text-sm font-semibold text-text-bright group-hover:text-accent">
											{p.name}
										</span>
										<ArrowRight className="h-3.5 w-3.5 text-text-muted transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
									</div>
									<p className="text-[12.5px] leading-relaxed text-text-secondary">
										{p.desc}
									</p>
								</Link>
							</InViewFade>
						))}
					</div>
				</section>

				{/* PROVIDER MATRIX */}
				<section className="mt-24" aria-labelledby="matrix-headline">
					<InViewFade>
						<p className="page-kicker">Provider routing</p>
						<h2 id="matrix-headline" className="h2-section mt-3 text-text-bright">
							Circuit-breaker failover across the catalog.
						</h2>
						<p className="mt-3 max-w-2xl text-text-secondary">
							When a provider is down or rate-limited, the gateway transparently
							routes to an equivalent model. Your code never has to handle
							retries.
						</p>
					</InViewFade>

					<div tabIndex={0} aria-label="Provider routing matrix" className="mt-8 overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
						<table className="w-full min-w-[40rem] text-left text-[13px]">
							<thead className="border-b border-border bg-void/50 font-mono text-[10.5px] uppercase tracking-wider text-text-muted">
								<tr>
									<th scope="col" className="px-4 py-3 font-semibold">Provider</th>
									<th scope="col" className="px-4 py-3 font-semibold">Privacy</th>
									<th scope="col" className="px-4 py-3 font-semibold">Routes</th>
									<th scope="col" className="px-4 py-3 font-semibold">Fallback</th>
									<th scope="col" className="px-4 py-3 font-semibold">Status</th>
								</tr>
							</thead>
							<tbody>
								{[
									{
										name: "Venice",
										privacy: "Zero retention",
										routes: "Frontier, premium, mid, budget chat",
										fallback: "Auto-reroute to next provider",
										status: "active",
									},
									{
										name: "OMA-AI (OMA-AI)",
										privacy: "Aggregator",
										routes: "Budget chat (Gemini 3 Flash)",
										fallback: "Auto-reroute to Venice",
										status: "active",
									},
									{
										name: "DuckDuckGo",
										privacy: "No key / no tracking of OMA queries",
										routes: "Playground WEB search (/v1/search)",
										fallback: "Answer without sources if empty",
										status: "active",
									},
								].map((row) => (
									<tr
										key={row.name}
										className="border-b border-border/40 last:border-b-0 transition-colors duration-200 ease-out hover:bg-void/30"
									>
										<td className="px-4 py-3 font-semibold text-text-bright">{row.name}</td>
										<td className="px-4 py-3 text-text-secondary">{row.privacy}</td>
										<td className="px-4 py-3 text-text-secondary">{row.routes}</td>
										<td className="px-4 py-3 text-text-secondary">{row.fallback}</td>
										<td className="px-4 py-3">
											<span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
												<span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
												{row.status}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>

				{/* CTA */}
				<section className="mt-24" aria-labelledby="cta-headline">
					<div className="rounded-2xl border border-accent/30 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent)_10%,var(--color-panel)),var(--color-panel))] p-8 sm:p-10">
						<div className="flex flex-col items-start gap-4">
							<h2
								id="cta-headline"
								className="text-2xl font-semibold text-text-bright sm:text-3xl"
							>
								Try a request in 30 seconds.
							</h2>
							<p className="max-w-xl text-text-secondary">
								No sign-up for the playground. Sign in to create an API key
								and buy credits.
							</p>
							<div className="flex flex-wrap gap-3">
								<Link
									href="/chat"
									className="btn-primary inline-flex h-12 items-center gap-2 px-6 text-sm"
								>
									<Sparkles className="h-4 w-4" aria-hidden="true" />
									Open playground
									<ArrowRight className="h-4 w-4" aria-hidden="true" />
								</Link>
								<Link
									href="/getting-started"
									className="btn-secondary inline-flex h-12 items-center gap-2 px-6 text-sm"
								>
									5-minute walkthrough
								</Link>
								<Link
									href="/docs"
									className="inline-flex h-12 items-center gap-2 rounded-md px-3 text-sm font-semibold text-text-secondary hover:text-accent"
								>
									Read the docs
									<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
								</Link>
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
