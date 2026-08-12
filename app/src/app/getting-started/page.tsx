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
				message. Guests get a handful of free messages every day using our fast, intelligent budget models — just to see how it works.
				You can chat, write code, or even generate <Link href="/chat?mode=create" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">images and video</Link> in one Create studio. No
				sign-up, no credit card, nothing to install.
			</>
		),
	},
	{
		icon: Rocket,
		title: "Sign in with email or wallet",
		body: (
			<>
				Head to <Link href="/login" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">login</Link>. Choose{" "}
				<strong className="text-text-bright"> email magic link</strong> (simplest — we email you a secure sign-in link, no password to remember)
				or <strong className="text-text-bright">connect wallet</strong> if you already use web3 apps. Signing in unlocks {MODEL_COUNT}+ frontier models like GPT-4o and Gemini, saved conversations, and higher rate limits.
			</>
		),
	},
	{
		icon: KeyRound,
		title: "Create an API key",
		body: (
			<>
				In your <Link href="/dashboard" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">dashboard</Link>,
				click &quot;Create Key&quot;. It will look like <code className="font-mono text-accent">oma_sk_...</code>. Copy it
				and treat it like a password. You use this one single key to talk to any of the models OMA supports. You can easily revoke it later if you need to.
			</>
		),
	},
	{
		icon: CreditCard,
		title: "Add a little credit",
		body: (
			<>
				Go to <Link href="/deposit" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">Deposit Credits</Link>. Pay with any standard credit card (Visa, Mastercard, Apple Pay) or send USDC on Base. Credits never expire, and a simple $5 deposit gives you enough tokens to handle thousands of requests.
				<br /><br />
				<strong>Autonomous Agent option:</strong> If you are writing software agents and prefer not to pre-fund an account, you can use our <Link href="/docs#x402" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">x402 pay-per-request flow</Link> to let your software pay for each request directly in USDC on-chain.
			</>
		),
	},
	{
		icon: Terminal,
		title: "Make your first API call",
		body: (
			<>
				You&apos;re done! OMA acts as a drop-in replacement for OpenAI&apos;s API. In any app, library, or script where you currently use OpenAI, just swap the base URL to <code className="font-mono text-accent">https://api.oma-ai.com/v1</code>, drop in your new API key, and specify any model from our <Link href="/models" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">catalog</Link> (like <code className="font-mono text-text-bright">gemini-3.1-pro-preview</code> or <code className="font-mono text-text-bright">gpt-4o</code>). Try the one-line examples below, or jump to the <Link href="/docs#quickstart" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">developer quickstart</Link>.
			</>
		),
	},
];

const SAMPLE_CODE = `curl https://api.oma-ai.com/v1/chat/completions \\
 -H "Authorization: Bearer $OMA_KEY" \\
 -H "Content-Type: application/json" \\
 -d '{
  "model": "gemini-3-flash-preview",
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
					className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors duration-200 ease-out mb-8"
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
						<li key={step.title} className="relative border border-border bg-surface/60 rounded-[var(--radius-lg)] p-5 sm:p-6">
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
					<section className="mt-10 rounded-[var(--radius-lg)] border border-border bg-void p-5 sm:p-6" aria-labelledby="try-heading">
					<h2 id="try-heading" className="flex items-center gap-2 text-base font-semibold text-text-bright">
						<Terminal className="h-4 w-4 text-accent" aria-hidden="true" />
						Try it right now
					</h2>
					<p className="mt-2 text-sm text-text-secondary">
						One request, copy-paste. Set <code className="font-mono text-accent">OMA_KEY</code> to your
						key first.
					</p>
					<pre tabIndex={0} aria-label="Quick start curl example" className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-void p-4 text-xs font-mono text-text-secondary leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
						{SAMPLE_CODE}
					</pre>
					<p className="mt-4 text-sm text-text-secondary">Or with the OpenAI Python SDK (works as-is):</p>
					<pre tabIndex={0} aria-label="OpenAI Python SDK example" className="mt-2 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-void p-4 text-xs font-mono text-text-secondary leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
						{SAMPLE_PY}
					</pre>
					</section>
				</InViewFade>

				<InViewFade delay={0.05}>
					<section className="mt-10 grid gap-4 sm:grid-cols-2" aria-label="Next steps">
					<Link
						href="/models"
						className="group flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-surface/60 p-5 transition-[color,border-color,background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						<div>
							<p className="text-xs font-mono uppercase tracking-wider text-text-muted">Next</p>
							<p className="mt-1 text-sm font-semibold text-text-bright group-hover:text-accent transition-colors duration-200 ease-out">
								Browse {MODEL_COUNT}+ models
							</p>
						</div>
						<ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" />
					</Link>
					<Link
						href="/pricing"
						className="group flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-surface/60 p-5 transition-[color,border-color,background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						<div>
							<p className="text-xs font-mono uppercase tracking-wider text-text-muted">Next</p>
							<p className="mt-1 text-sm font-semibold text-text-bright group-hover:text-accent transition-colors duration-200 ease-out">
								See what things cost
							</p>
						</div>
						<ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" />
					</Link>
					<Link
						href="/faq"
						className="group flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-surface/60 p-5 transition-[color,border-color,background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						<div>
							<p className="text-xs font-mono uppercase tracking-wider text-text-muted">Next</p>
							<p className="mt-1 text-sm font-semibold text-text-bright group-hover:text-accent transition-colors duration-200 ease-out">
								Read the FAQ
							</p>
						</div>
						<ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" />
					</Link>
					<Link
						href="/docs"
						className="group flex items-center justify-between rounded-[var(--radius-lg)] border border-border bg-surface/60 p-5 transition-[color,border-color,background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-accent/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						<div>
							<p className="text-xs font-mono uppercase tracking-wider text-text-muted">I&apos;m a developer</p>
							<p className="mt-1 text-sm font-semibold text-text-bright group-hover:text-accent transition-colors duration-200 ease-out">
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
