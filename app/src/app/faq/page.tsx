import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MODEL_COUNT } from "@/lib/models-data";
import { FloatingIcons } from "@/components/floating-icons";
import { InViewFade } from "@/components/motion/in-view-fade";
import { BreadcrumbListJsonLd, FAQPageJsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
	title: "FAQ — Questions answered in plain language",
	description:
		"Plain-language answers for first-time users and developers: accounts, API keys, USDC payments, x402, tokens, models, privacy, and how to start.",
	alternates: { canonical: "/faq" },
	openGraph: {
		title: "FAQ — OMA AI, explained simply",
		description:
			"Do I need a wallet? What is an API key? What is a token? Plain-language answers to the questions everyone asks.",
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA FAQ" }],
	},
	robots: { index: true, follow: true },
};

const FAQ_GROUPS: { heading: string; items: { q: string; a: string }[] }[] = [
	{
		heading: "Getting started",
		items: [
			{
				q: "What is OMA?",
				a: `OMA (Open Model Access) is a single place to use many AI models. Instead of signing up for ten different AI companies, you get one account, one API key, and one way to pay. It works exactly like OpenAI's API, so almost any AI app or tool that supports OpenAI already works with OMA.`,
			},
			{
				q: "Do I need to know how to code?",
				a: "No. You can try AI immediately in the free chat playground at /chat — type a message, pick a model, done. You only need the API (and an API key) when you want to build something, like an app or a script.",
			},
			{
				q: "How do I start using it?",
				a: `Three steps: (1) try the free chat playground — no account needed; (2) sign in with your email (magic link) or crypto wallet and create an API key; (3) add a little credit and call the API. The full walkthrough is on the /getting-started page.`,
			},
			{
				q: "What can I do with it?",
				a: `Chat, write code, summarize documents, analyze data, generate images and short videos, and more — across ${MODEL_COUNT}+ models from many providers through one API.`,
			},
		],
	},
	{
		heading: "Accounts, keys & privacy",
		items: [
			{
				q: "What is an API key?",
				a: "An API key is like a password that lets your code (or an AI tool you use) talk to OMA on your behalf. It looks like `oma_sk_...`. Keep it secret — anyone with your key can spend your credits. You can create and revoke keys from the dashboard.",
			},
			{
				q: "What is a magic link?",
				a: "A magic link is a sign-in without a password. You enter your email, we send you a link, you click it, and you're signed in. No passwords to remember.",
			},
			{
				q: "What is a wallet (SIWE) and do I need one?",
				a: "SIWE (Sign-In With Ethereum) lets you sign in with a crypto wallet instead of an email. You do NOT need a wallet for email sign-in or card payments — only for the USDC pay-per-request (x402) flow, which is an advanced option.",
			},
			{
				q: "Is my data private?",
				a: "Yes, by design. OMA meters usage for billing but does not log prompt or completion content — zero data retention on prompt content. See /privacy for details.",
			},
		],
	},
	{
		heading: "Money & payments",
		items: [
			{
				q: "How do I pay?",
				a: "Two ways: (1) buy credits with a card (Visa/Mastercard/Apple Pay) or USDC deposit, then use credits per request — the simplest path; or (2) pay-per-request directly in USDC on Base with x402 — no account, no pre-funding, designed for AI agents. Credits never expire.",
			},
			{
				q: "What is USDC? What is Base?",
				a: "USDC is a stablecoin — a digital dollar that stays worth $1. Base is a fast, cheap blockchain network built by Coinbase where OMA settles payments. Think of it as an automatic, code-friendly payment rail instead of a credit card.",
			},
			{
				q: "What is x402?",
				a: "x402 is a standard for paying for a single API request with crypto, automatically. Your AI agent asks for a request, the API replies 'pay X USDC', the agent signs the payment, and the request completes — no account or key needed for one-off calls. It's like a vending machine for AI.",
			},
			{
				q: "How much does it cost?",
				a: `A typical chat answer costs a fraction of a cent. Budget models start around $0.015 per million tokens of input. Images are $0.10 each and videos $0.92. There is no subscription and no monthly fee — you only pay for what you use. See /pricing for the full breakdown.`,
			},
			{
				q: "What happens when I run out of credits?",
				a: "Requests stop with a clear 'insufficient quota' message until you top up. Your keys, conversations, and account all stay intact.",
			},
		],
	},
	{
		heading: "Models, tokens & chat",
		items: [
			{
				q: "What is a model?",
				a: "A model is a specific AI brain with a personality and strengths — like a faster-cheaper one for simple chat, or a bigger one for math and code. You pick the model per request, or let OMA route automatically.",
			},
			{
				q: "What is a token?",
				a: "A token is roughly a piece of a word — 'hello' is about one token, 'hello world' about two. AI prices and limits are measured in tokens (and you'll see 'tokens per second' while chatting). A typical English word is 1–2 tokens.",
			},
			{
				q: "What is a context window?",
				a: "The context window is how much text a model can see at once — your whole conversation plus the answer. Bigger windows (some OMA models handle 1M+ tokens) mean the model can read entire books or large codebases in one go.",
			},
			{
				q: "What does 'OpenAI-compatible' mean?",
				a: "It means OMA speaks the same language as OpenAI's API. Apps, libraries, and tutorials written for OpenAI (like the openai-python package or the Vercel AI SDK) work with OMA by changing one line: the API base URL.",
			},
			{
				q: "What is streaming?",
				a: "Streaming shows the answer as it's being written, word by word, instead of waiting for the whole thing. Most chat apps use it — it feels faster and you can read along.",
			},
			{
				q: "Which model should I pick?",
				a: "Start with a budget or mid model for everyday chat, and reach for frontier models for hard math, code, or long documents. The chat UI shows each model's price, context length, and strengths, and /models has the full catalog.",
			},
			{
				q: "Do you support multimodal inputs?",
				a: "Yes — frontier and premium models accept image inputs alongside text. Send them in the OpenAI multimodal `messages[].content` array shape (array of `{type:'text'|'image_url',...}` parts). The chat UI uploads images directly via the composer.",
			},
		],
	},
	{
		heading: "For developers",
		items: [
			{
				q: "Where are the API docs?",
				a: "The full reference is at /docs — quickstart, authentication, every endpoint, streaming, rate limits, errors, and the x402 flow. There's a search box at the top.",
			},
			{
				q: "Is there a quickstart?",
				a: "Yes — /getting-started walks through your first request in under five minutes with copy-paste code, and /docs#quickstart has the developer version.",
			},
			{
				q: "Can my AI agent use OMA?",
				a: `Yes, and it can even set itself up: point it at /agent-skill.md (a plain-text instruction file) and it can create an account, make a key, and verify with a test request — including the x402 pay-per-request flow. OMA also publishes an A2A agent card at /.well-known/agent-card.json and a machine-readable /llms.txt.`,
			},
			{
				q: "What happens when a model provider is down?",
				a: "OMA's circuit-breaker failover automatically reroutes to an equivalent model from another provider, so your request still gets an answer.",
			},
			{
				q: "I got a 402 error — what now?",
				a: "A 402 means payment is required: either your credits ran out (top up at /deposit), or you hit the x402 pay-per-request flow (sign the payment and retry — docs: /docs#x402). If you keep getting 402s on x402, ensure your wallet has enough USDC on Base, that you have approved the deposit, and that you are signing the exact transaction details the API returned.",
			},
			{
				q: "How do I troubleshoot x402 errors?",
				a: "Common x402 issues: 1) Wrong network: ensure you are on Base. 2) Insufficient USDC allowance: you must approve the EIP-3009 transfer. 3) Signature mismatch: verify you are signing the exact payload returned by the API (no extra fields or trailing spaces). 4) Stale nonce: if you parallelize requests, handle nonces carefully.",
			},
		],
	},
];

/**
 * Renders FAQ answer prose with safe inline links.
 *
 * Only known internal site routes become links. Everything else that
 * looks like a path (API endpoints like /v1/images/generations, files
 * like /agent-skill.md, /.well-known/agent-card.json) renders as inline
 * code instead of a broken link.
 */
const FAQ_LINK_ROUTES = new Set([
	"/chat",
	"/contact",
	"/deposit",
	"/docs",
	"/docs#x402",
	"/docs#quickstart",
	"/getting-started",
	"/glossary",
	"/models",
	"/pricing",
	"/privacy",
]);

// Matches path-like tokens: /v1/images/generations, /agent-skill.md,
// /.well-known/agent-card.json, /docs#x402, /chat
const PATH_TOKEN_RE =
	/(\/[a-z0-9-]+(?:\.[a-z0-9-]+)?(?:#[a-z0-9-]+)?(?:\/[a-z0-9-]+(?:\.[a-z0-9-]+)?)*)/g;

function AnswerText({ text }: { text: string }) {
	return (
		<>
			{text.split(PATH_TOKEN_RE).map((part, i) => {
				if (!part.startsWith("/")) return part;
				if (FAQ_LINK_ROUTES.has(part)) {
					return (
						<Link
							key={i}
							href={part}
							className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
						>
							{part}
						</Link>
					);
				}
				return (
					<code
						key={i}
						className="rounded-[var(--radius-sm)] bg-surface px-1 py-0.5 font-mono text-[0.85em] text-text-secondary"
					>
						{part}
					</code>
				);
			})}
		</>
	);
}

export default function FAQPage() {
	const questions = FAQ_GROUPS.flatMap((g) =>
		g.items.map((item) => ({ question: item.q, answer: item.a })),
	);
	return (
		<div className="relative min-h-screen bg-void text-text overflow-hidden">
			<BreadcrumbListJsonLd items={[{ name: "Home", url: "/" }, { name: "FAQ", url: "/faq" }]} />
			<FAQPageJsonLd questions={questions} />
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

				<span className="page-kicker">Help center</span>
				<h1 className="display-headline mt-3 text-text-bright">FAQ</h1>
				<p className="page-intro mt-4 max-w-2xl">
					Plain-language answers for people who have never used an AI API —
					and links for developers who want the deep detail. New to all of
					this? Start at <Link href="/getting-started" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">getting started</Link> or the{" "}
					<Link href="/glossary" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">glossary</Link>.
				</p>

				<div className="mt-10 space-y-10">
					{FAQ_GROUPS.map((group, gi) => (
						<InViewFade key={group.heading} delay={Math.min(gi * 0.05, 0.25)}>
							<section aria-labelledby={group.heading.replace(/\W+/g, "-").toLowerCase()}>
							<h2
								id={group.heading.replace(/\W+/g, "-").toLowerCase()}
								className="text-sm font-mono font-bold uppercase tracking-wider text-accent mb-4"
							>
								{group.heading}
							</h2>
							<div className="space-y-3">
								{group.items.map((item) => (
									<details
										key={item.q}
										className="group border border-border bg-surface/60 hover:border-accent/30 transition-colors duration-200 ease-out rounded-[var(--radius-lg)] overflow-hidden"
										open={false}
									>
										<summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium text-text-bright hover:text-accent transition-colors duration-200 ease-out [&::-webkit-details-marker]:hidden">
											{item.q}
											<span className="shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-45 text-lg leading-none" aria-hidden="true">
												+
											</span>
										</summary>
									<div className="px-4 pb-4 text-sm leading-relaxed text-text-secondary">
										<AnswerText text={item.a} />
									</div>
									</details>
								))}
							</div>
						</section>
						</InViewFade>
					))}
				</div>

				<div className="mt-12 rounded-[var(--radius-lg)] border border-accent/25 bg-accent/5 p-5 text-sm text-text-secondary">
					<p className="font-semibold text-text-bright mb-1">Still stuck?</p>
					<p>
						Reach us at <Link href="/contact" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">/contact</Link> — real
						humans, no bots. The{" "}
						<Link href="/docs" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">API docs</Link> and{" "}
						<Link href="/pricing" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">pricing</Link> pages have the
						technical detail.
					</p>
				</div>
			</div>
		</div>
	);
}
