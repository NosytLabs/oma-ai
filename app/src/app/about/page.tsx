import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Cpu, Shield, Wallet } from "lucide-react";
import { MODEL_COUNT } from "@/lib/models-data";

export const metadata: Metadata = {
	title: "About OMA — Open Model Access",
	description:
		"OMA is an OpenAI-compatible AI inference gateway with wallet auth, multi-provider routing, and USDC pay-per-request on Base. Built for agents and developers.",
	alternates: { canonical: "/about" },
	openGraph: {
		title: "About OMA — Open Model Access",
		description:
			"One gateway. Every model. Wallet auth and USDC pay-per-request — no lock-in.",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "About OMA" }],
	},
};

const PILLARS = [
	{
		icon: Cpu,
		title: "Open Model Access",
		body: `One OpenAI-compatible API across ${MODEL_COUNT}+ models and multiple providers, with circuit-breaker failover when an upstream is down.`,
	},
	{
		icon: Wallet,
		title: "Crypto-native billing",
		body: "Pay per request in USDC on Base, or settle with x402 receipts. No credit-card gate for agents or privacy-first users.",
	},
	{
		icon: Shield,
		title: "Privacy by default",
		body: "SIWE wallet auth or private account numbers. We meter usage for billing; we do not log prompt or completion content.",
	},
] as const;

export default function AboutPage() {
	return (
		<div className="min-h-screen bg-void text-text">
			<div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
				<Link
					href="/"
					className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors mb-10"
				>
					<ArrowLeft className="h-4 w-4" aria-hidden="true" />
					Home
				</Link>

				<p className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent mb-3">
					about
				</p>
				<h1 className="text-3xl sm:text-4xl font-semibold text-text-bright mb-4">
					Open Model Access
				</h1>
				<p className="text-text-secondary max-w-xl mb-12 leading-relaxed text-lg">
					OMA is a self-hosted-friendly AI inference gateway: drop-in OpenAI
					API compatibility, multi-provider routing, and native crypto payments
					for developers and autonomous agents.
				</p>

				<ul className="space-y-4 mb-14">
					{PILLARS.map((p) => (
						<li
							key={p.title}
							className="rounded-xl border border-border bg-surface p-5"
						>
							<div className="flex items-start gap-3">
								<p.icon
									className="h-5 w-5 text-accent shrink-0 mt-0.5"
									aria-hidden="true"
								/>
								<div>
									<h2 className="text-base font-semibold text-text-bright">
										{p.title}
									</h2>
									<p className="mt-1 text-sm text-text-secondary leading-relaxed">
										{p.body}
									</p>
								</div>
							</div>
						</li>
					))}
				</ul>

				<div className="flex flex-wrap gap-3">
					<Link
						href="/login"
						className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-void hover:bg-accent-bright transition-colors"
					>
						Get an API key
						<ArrowRight className="h-4 w-4" aria-hidden="true" />
					</Link>
					<Link
						href="/docs"
						className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-bright hover:border-accent/40 transition-colors"
					>
						Read the docs
					</Link>
					<Link
						href="/contact"
						className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-bright hover:border-accent/40 transition-colors"
					>
						Contact
					</Link>
				</div>
			</div>
		</div>
	);
}
