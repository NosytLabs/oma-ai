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
		title: "About OMA — Open Model Access",
		description:
			"One gateway. Every model. Wallet auth and USDC x402 settlement — no lock-in.",
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "About OMA" }],
	},
	robots: { index: true, follow: true },
};

const PILLARS = [
	{
		icon: Cpu,
		title: "Open Model Access",
		body: `One OpenAI-compatible API across ${MODEL_COUNT} curated models and multiple providers, with circuit-breaker failover when an upstream is down.`,
	},
	{
		icon: Wallet,
		title: "Crypto-native billing",
		body: "Pay per request in USDC on Base, or settle with x402 receipts. No credit-card gate for agents or privacy-first users.",
	},
	{
		icon: Shield,
		title: "Privacy by default",
		body: "SIWE wallet auth and magic-link email. No credit-card signup. We meter usage for billing; we do not log prompt or completion content.",
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
			<p className="page-intro mt-4 mb-10 max-w-2xl">
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
