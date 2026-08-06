import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CreditCard, KeyRound, MessageSquare, Rocket, Terminal, Wallet } from "lucide-react";
import { MODEL_COUNT } from "@/lib/models-data";
import { FloatingIcons } from "@/components/floating-icons";
import { InViewFade } from "@/components/motion/in-view-fade";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
	title: "Getting started — how to use OMA in 5 minutes",
	description:
		"Use OMA without any prior AI or crypto experience: try the free chat, create an account, make an API key, add credits, and make your first API call.",
	alternates: { canonical: "/getting-started" },
	openGraph: {
		title: "How to use OMA — 5-minute walkthrough",
		description:
			"No code? No crypto? No problem. Try AI in the free playground, then get your first API key in minutes.",
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "Getting started with OMA" }],
	},
	robots: { index: true, follow: true },
};

const STEPS = [
	{
		icon: MessageSquare,
		title: "Try it free — no account needed",
		body: (
			<>
				Open the <Link href="/chat" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">chat playground</Link> and send a
				message. Guests get a handful of free messages on a budget model every day — just to feel how it works.
				Try the <Link href="/chat" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">image</Link> and video tabs too. No
				sign-up, no credit card, nothing to install.
			</>
		),
	},
	{
		icon: Rocket,
		title: "Sign in with email or wallet",
		body: (
			<>
				Head to <Link href="/login" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">/login</Link>. Choose{" "}
				<strong className="text-text-bright">email magic link</strong> (simplest — we email you a sign-in
				link, no password) or <strong className="text-text-bright">wallet (SIWE)</strong> if you&apos;re
				crypto-native. Signing in unlocks paid models, saved conversations, and higher limits.
			</>
		),
	},
	{
		icon: KeyRound,
		title: "Create an API key",
		body: (
			<>
				In your <Link href="/dashboard" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">dashboard</Link> (API Keys
				tab), create a key. It looks like <code className="font-mono text-accent">oma_sk_...</code> — copy it
				somewhere safe and treat it like a password. You can create several (one per app) and revoke any of
				them anytime.
			</>
		),
	},
	{
		icon: CreditCard,
		title: "Add a little credit",
		body: (
			<>
				Go to <Link href="/deposit" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">/deposit</Link>. Pay with a
				regular card (Visa / Mastercard / Apple Pay) or deposit USDC on Base. Credits never expire, and a
				$5 top-up (500 credits) covers tens of thousands of budget chat requests. If you&apos;re an agent and never want an account at all,
				skip this step — the{" "}
				<Link href="/docs#x402" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">x402 pay-per-request flow</Link>{" "}
				settles each call in USDC automatically.
			</>
		),
	},
	{
		icon: Terminal,
		title: "Make your first API call",
		body: (
			<>
				That&apos;s it. You can now call any model from any code, or plug OMA into your favourite AI app by
				changing the base URL to <code className="font-mono text-accent">https://api.oma-ai.com/v1</code>.
				Try the one-line examples below, or jump to the{" "}
				<Link href="/docs#quickstart" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">developer quickstart</Link>.
			</>
		),
	},
];

const SAMPLE_CODE = `curl https://api.oma-ai.com/v1/chat/completions \\
  -H "Authorization: Bearer $OMA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b",
    "messages": [{"role": "user", "content": "Say hello in one short sentence"}],
    "max_tokens": 64
  }'`;

const SAMPLE_PY = `from openai import OpenAI

client = OpenAI(
    base_url="https://api.oma-ai.com/v1",
    api_key=os.environ["OMA_KEY"],
)
reply = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Say hello in one short sentence"}],
)
print(reply.choices[0].message.content)`;

export default function GettingStartedPage() {
	return (
		<div className="relative min-h-screen bg-void text-text overflow-hidden">
			<BreadcrumbListJsonLd
				items={[{ name: "Home", url: "/" }, { name: "Getting started", url: "/getting-started" }]}
			/>
			<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
				<div className="absolute inset-0 bg-grid opacity-[0.35] mask-radial" />
				<FloatingIcons count={4} />
			</div>

			<div className="container-page max-w-3xl pt-6 sm:pt-8 pb-12 sm:pb-16">
				<Link
					href="/"
					className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors mb-8"
				>
					<ArrowLeft className="h-4 w-4" aria-hidden="true" />
					Home
				</Link>

				<span className="page-kicker">First time here?</span>
				<h1 className="display-headline mt-3 text-text-bright">How to use OMA — 5 minutes, no jargon</h1>
				<p className="page-intro mt-4 max-w-2xl">
					OMA is one account for {MODEL_COUNT}+ AI models from many providers, paid your way. You do{" "}
					<em className="text-text-bright">not</em> need to be a developer or a crypto person to start.
					This is the whole site, in order. Developers: the{" "}
					<Link href="/docs" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">API docs</Link> are your fast lane.
				</p>

				<ol className="mt-10 space-y-6">
					{STEPS.map((step, i) => (
						<li key={step.title} className="relative border border-border bg-surface/60 rounded-lg p-5 sm:p-6">
								<div className="flex items-start gap-4">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10">
										<step.icon className="h-4 w-4 text-accent" aria-hidden="true" />
									</div>
									<div className="min-w-0">
										<h2 className="text-base font-semibold text-text-bright">
											<span className="mr-2 font-mono text-accent text-sm">0{i + 1}</span>
											{step.title}
										</h2>
										<div className="mt-2 text-sm leading-relaxed text-text-secondary">{step.body}</div>
									</div>
								</div>
						</li>
					))}
				</ol>

				<InViewFade delay={0.05}>
					<section className="mt-10 rounded-lg border border-border bg-void p-5 sm:p-6" aria-labelledby="try-heading">
					<h2 id="try-heading" className="flex items-center gap-2 text-base font-semibold text-text-bright">
						<Terminal className="h-4 w-4 text-accent" aria-hidden="true" />
						Try it right now
					</h2>
					<p className="mt-2 text-sm text-text-secondary">
						One request, copy-paste. Set <code className="font-mono text-accent">OMA_KEY</code> to your
						key first.
					</p>
					<pre tabIndex={0} aria-label="Quick start curl example" className="mt-4 overflow-x-auto rounded border border-border bg-void p-4 text-xs font-mono text-text-secondary leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
						{SAMPLE_CODE}
					</pre>
					<p className="mt-4 text-sm text-text-secondary">Or with the OpenAI Python SDK (works as-is):</p>
					<pre tabIndex={0} aria-label="OpenAI Python SDK example" className="mt-2 overflow-x-auto rounded border border-border bg-void p-4 text-xs font-mono text-text-secondary leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
						{SAMPLE_PY}
					</pre>
					</section>
				</InViewFade>

				<InViewFade delay={0.05}>
					<section className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="Next steps">
					<Link
						href="/models"
						className="group flex items-center justify-between rounded-lg border border-border bg-surface/60 p-5 transition-colors hover:border-accent/40"
					>
						<div>
							<p className="text-xs font-mono uppercase tracking-wider text-text-muted">Next</p>
							<p className="mt-1 text-sm font-semibold text-text-bright group-hover:text-accent transition-colors">
								Browse {MODEL_COUNT}+ models
							</p>
						</div>
						<ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" />
					</Link>
					<Link
						href="/pricing"
						className="group flex items-center justify-between rounded-lg border border-border bg-surface/60 p-5 transition-colors hover:border-accent/40"
					>
						<div>
							<p className="text-xs font-mono uppercase tracking-wider text-text-muted">Next</p>
							<p className="mt-1 text-sm font-semibold text-text-bright group-hover:text-accent transition-colors">
								See what things cost
							</p>
						</div>
						<ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" />
					</Link>
					<Link
						href="/faq"
						className="group flex items-center justify-between rounded-lg border border-border bg-surface/60 p-5 transition-colors hover:border-accent/40"
					>
						<div>
							<p className="text-xs font-mono uppercase tracking-wider text-text-muted">Next</p>
							<p className="mt-1 text-sm font-semibold text-text-bright group-hover:text-accent transition-colors">
								Read the FAQ
							</p>
						</div>
						<ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" />
					</Link>
					<Link
						href="/docs"
						className="group flex items-center justify-between rounded-lg border border-border bg-surface/60 p-5 transition-colors hover:border-accent/40"
					>
						<div>
							<p className="text-xs font-mono uppercase tracking-wider text-text-muted">I&apos;m a developer</p>
							<p className="mt-1 text-sm font-semibold text-text-bright group-hover:text-accent transition-colors">
								Jump to the API docs
							</p>
						</div>
						<ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" />
					</Link>
					</section>
				</InViewFade>

				<div className="mt-10 flex flex-wrap items-center gap-2 text-xs font-mono text-text-muted">
					<Wallet className="h-3.5 w-3.5" aria-hidden="true" />
					<span>No wallet needed for email sign-in or card payments · USDC &amp; x402 are optional superpowers</span>
				</div>
			</div>
		</div>
	);
}
