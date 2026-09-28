import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Cpu, Shield, Wallet } from "lucide-react";
import { MODEL_COUNT } from "@/lib/models-data";
import { InViewFade } from "@/components/motion/in-view-fade";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import { PageShell } from "@/app/_components/page-shell";

export const metadata: Metadata = {
	title: "About OMA — Open Model Access",
	description:
		"OMA is an OpenAI-compatible AI inference gateway with wallet auth, multi-provider routing, and USDC x402 settlement on Base. Built for agents and developers.",
	alternates: { canonical: "/about" },
	openGraph: {
		locale: "en_US",
		title: "About OMA — Open Model Access",
		description:
			"One gateway. Every model. Wallet auth and USDC x402 settlement — no lock-in.",
		url: "/about",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "About OMA" }],
	},
	robots: { index: true, follow: true },
};

const PILLARS = [
	{
		icon: Cpu,
		title: "Open Model Access",
		body: `One OpenAI-compatible API across ${MODEL_COUNT} curated models and multiple providers, with circuit-breaker protection and configured fallbacks where available.`,
	},
	{
		icon: Wallet,
		title: "Crypto-native billing",
		body: "Deposit USDC on Base, or settle via x402 to credit a balance, then spend with an API key. Card checkout is optional when Polar is enabled.",
	},
	{
		icon: Shield,
		title: "Minimal OMA retention",
		body: "SIWE wallet auth and magic-link email. OMA meters billing metadata but does not persist prompt or completion content; inference providers process requests as described in Privacy.",
	},
] as const;

const USE_CASES = [
	{
		title: "Migrate an OpenAI-compatible app",
		body: "Keep your existing SDK and request shape. Change the base URL, use an OMA key, and choose a catalog model per request.",
		href: "/docs#quickstart",
		cta: "Migration quickstart",
	},
	{
		title: "Compare models without rebuilding",
		body: "Use one catalog to compare model price, context window, provider, and capabilities instead of maintaining separate vendor integrations.",
		href: "/models",
		cta: "Browse models",
	},
	{
		title: "Run automated agent workloads",
		body: "Use API keys with prepaid credits, direct USDC deposits, or the optional x402 settlement flow for software-driven funding.",
		href: "/docs#x402",
		cta: "Agent payment docs",
	},
] as const;

export default function AboutPage() {
	return (
		<div className="relative bg-void text-text overflow-x-clip">
			<BreadcrumbListJsonLd
				items={[
					{ name: "Home", url: "/" },
					{ name: "About", url: "/about" },
				]}
			/>

			<PageShell>
				<Link
					href="/"
					className="flex w-fit min-h-11 items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors duration-200 ease-out mb-10"
				>
					<ArrowLeft className="h-4 w-4" aria-hidden="true" />
					Home
				</Link>

			<span className="section-eyebrow-caps">
				about
			</span>
			<h1 className="display-headline mt-3 text-text-bright">
				Open Model Access
			</h1>
			<p className="page-intro mb-10 max-w-2xl">
					OMA is a self-hosted-friendly AI inference gateway: drop-in OpenAI
					API compatibility, multi-provider routing, and native crypto payments
					for developers and autonomous agents.
				</p>

				<ul className="space-y-3 mb-14">
					{PILLARS.map((p, i) => (
						<li key={p.title}>
							<InViewFade delay={i * 0.08} y={12}>
								<div className="rounded-[var(--radius-md)] border border-border bg-surface p-5 transition-colors duration-200 ease-out hover:border-accent/30">
									<div className="flex items-start gap-3">
										<p.icon
											className="h-5 w-5 text-accent shrink-0 mt-0.5"
											aria-hidden="true"
										/>
										<div>
											<h2 className="text-base font-display font-medium text-text-bright">
												{p.title}
											</h2>
											<p className="mt-1 text-sm text-text-secondary leading-relaxed">
												{p.body}
											</p>
										</div>
									</div>
								</div>
							</InViewFade>
						</li>
					))}
				</ul>

				<section className="mb-14" aria-labelledby="how-oma-works">
					<h2
						id="how-oma-works"
						className="section-eyebrow-caps text-text-bright"
					>
						How OMA works
					</h2>
					<div className="mt-4 space-y-3 text-sm text-text-secondary leading-relaxed max-w-2xl">
						<p>
							OMA is a single OpenAI-compatible endpoint —
							<code className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[13px] text-text-bright">https://www.oma-ai.com/api/v1</code> —
							in front of a rotating catalog of chat models routed across
							multiple upstream providers. Each requested model resolves to
							its configured upstream route. Circuit breakers stop repeated
							calls to unhealthy routes, and mapped models can use a configured
							fallback where one is available.
						</p>
						<p>
							You pay from a prepaid credit balance. Top up with a card when
							Polar checkout is enabled, deposit USDC directly on Base to the
							deposit address, or fund the balance via x402 (EIP-3009). An agent
							signs a payment authorization, OMA verifies and broadcasts the transfer,
							then settlement credits the account for API-key spending. There are
							no subscriptions; funding methods have their own deposit limits.
						</p>
						<p>
							Auth is passwordless by default: magic-link email or SIWE with
							your existing wallet. Usage and spend are metered for billing;
							prompt and completion content are not logged.
						</p>
					</div>
				</section>

				<section className="mb-14" aria-labelledby="what-oma-is-for">
					<h2 id="what-oma-is-for" className="section-eyebrow-caps text-text-bright">
						What OMA is for
					</h2>
					<div className="mt-4 grid gap-3 md:grid-cols-3">
						{USE_CASES.map((item) => (
							<Link
								key={item.title}
								href={item.href}
								className="group rounded-[var(--radius-md)] border border-border bg-surface p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/40"
							>
								<h3 className="font-display text-base font-medium text-text-bright">
									{item.title}
								</h3>
								<p className="mt-2 text-sm leading-relaxed text-text-secondary">
									{item.body}
								</p>
								<span className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono text-accent">
									{item.cta}
									<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
								</span>
							</Link>
						))}
					</div>
				</section>

				<section className="mb-14" aria-labelledby="operational-boundaries">
					<h2 id="operational-boundaries" className="section-eyebrow-caps text-text-bright">
						Operational boundaries
					</h2>
					<ul className="mt-4 max-w-2xl space-y-3 text-sm leading-relaxed text-text-secondary">
						<li>
							<strong className="text-text-bright">Availability changes.</strong>{" "}
							Model capacity and upstream health are live conditions. Check the{" "}
							<Link href="/models" className="text-accent underline underline-offset-2">catalog</Link>{" "}
							and <Link href="/status" className="text-accent underline underline-offset-2">status page</Link>{" "}
							before depending on a model in production.
						</li>
						<li>
							<strong className="text-text-bright">Free chat is not free API traffic.</strong>{" "}
							The OMA-AI browser-chat allowance has daily caps; API-key calls spend credits at the listed rate.
						</li>
						<li>
							<strong className="text-text-bright">Inference still has a data path.</strong>{" "}
							OMA does not persist prompt or completion content, but the inference provider that handles a request must process that content to return an answer. See{" "}
							<Link href="/privacy" className="text-accent underline underline-offset-2">Privacy</Link>.
						</li>
					</ul>
				</section>

				<div className="flex flex-wrap gap-3">
					<Link href="/login" className="btn-mono btn-primary">
						<span>Get API key</span>
						<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
					</Link>
					<Link href="/docs" className="btn-mono">
						<span>Read the docs</span>
					</Link>
					<Link href="/contact" className="btn-mono">
						<span>Contact</span>
					</Link>
				</div>
			</PageShell>
		</div>
	);
}
