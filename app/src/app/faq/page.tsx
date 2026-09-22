import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MODEL_COUNT } from "@/lib/models-data";
import { BreadcrumbListJsonLd, FAQPageJsonLd } from "@/components/json-ld";
import { FAQContent } from "./_components/FAQContent";
import { PageShell } from "@/app/_components/page-shell";

export const metadata: Metadata = {
	title: "FAQ — Questions answered in plain language",
	description:
		"Plain-language answers for first-time users and developers: accounts, API keys, USDC payments, x402, tokens, models, privacy, and how to start.",
	alternates: { canonical: "/faq" },
	openGraph: {
		title: "FAQ — OMA AI, explained simply",
		description:
			"Do I need a wallet? What is an API key? What is a token? Plain-language answers to the questions everyone asks.",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA FAQ" }],
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
				a: "No. You can try AI immediately in the free chat playground at /chat — no account needed. Guests can use the two free OMA-AI models (DeepSeek V4 Flash OpenBroker and MiniMax M2.7) with a daily message cap. You only need the API (and an API key) when you want to build something, like an app or a script.",
			},
			{
				q: "How do I start using it?",
				a: `Three steps: (1) try free website chat on the two OMA-AI models — no account needed; (2) sign in with your email (magic link) or crypto wallet and create an API key; (3) add a little credit and call the API. The full walkthrough is on the /getting-started page.`,
			},
			{
				q: "What can I do with it?",
				a: `Chat, write code, summarize documents, analyze data, work with image inputs, and more — across ${MODEL_COUNT} models from many providers through one API.`,
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
				a: "SIWE (Sign-In With Ethereum) lets you sign in with a crypto wallet instead of an email. You do NOT need a wallet for email sign-in or card checkout when it is enabled. A wallet is needed for direct USDC deposits and the advanced x402 settlement flow.",
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
				a: "Deposit USDC on Base, then spend credits per request. Agents can also fund via x402 verify/settle, which credits the same balance before API spend. Card checkout through Polar is available only when it is enabled, and the credits page shows its live status. Credits never expire while your account is active.",
			},
			{
				q: "What is USDC? What is Base?",
				a: "USDC is a stablecoin — a digital dollar that stays worth $1. Base is a fast, cheap blockchain network built by Coinbase where OMA settles payments. Think of it as an automatic, code-friendly payment rail instead of a credit card.",
			},
			{
				q: "What is x402?",
				a: "x402 is a crypto payment flow for agents: sign a USDC authorization on Base, verify at /x402/verify, settle to credit your account, then call the API with your key. Inference itself is billed from that credit balance — not attached as a mid-request 402 on chat today.",
			},
			{
				q: "How much does it cost?",
				a: `A typical chat answer costs a fraction of a cent. Budget models start at $0.50 per million tokens of input. OMA-AI currently focuses on curating chat models. There is no subscription and no monthly fee — you only pay for what you use. See /pricing for the full breakdown.`,
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
				a: "The context window is how much text a model can see at once — your whole conversation plus the answer. Bigger windows mean the model can read entire books or large codebases in one go. OMA-AI models offer 200K–400K tokens; some Venice-routed models go up to 1M. Each model page shows its exact window.",
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
				a: `Yes, and it can even set itself up: point it at /agent-skill.md (a plain-text instruction file) and it can create an account, make a key, and verify with a test request — including the x402 settlement flow. OMA also publishes an A2A agent card at /.well-known/agent-card.json and a machine-readable /llms.txt.`,
			},
			{
				q: "What happens when a model provider is down?",
				a: "OMA's circuit-breaker failover automatically reroutes to an equivalent model from another provider, so your request still gets an answer.",
			},
			{
				q: "I got a 402 error — what now?",
				a: "A 402 means payment is required — usually your credit balance is empty. Top up at /deposit (USDC or card when enabled), or use the x402 verify/settle flow to credit your balance, then retry with an API key (docs: /docs#x402).",
			},
			{
				q: "How do I troubleshoot x402 errors?",
				a: "Common x402 issues: 1) Wrong network: ensure you are on Base. 2) Insufficient USDC allowance: you must approve the EIP-3009 transfer. 3) Signature mismatch: verify you are signing the exact payload returned by the API (no extra fields or trailing spaces). 4) Stale nonce: if you parallelize requests, handle nonces carefully.",
			},
		],
	},
];

export default function FAQPage() {
	const questions = FAQ_GROUPS.flatMap((g) =>
		g.items.map((item) => ({ question: item.q, answer: item.a })),
	);
	return (
		<div className="relative bg-void text-text overflow-x-clip">
			<BreadcrumbListJsonLd items={[{ name: "Home", url: "/" }, { name: "FAQ", url: "/faq" }]} />
			<FAQPageJsonLd questions={questions} />
			<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
				<div className="absolute inset-0 bg-grid opacity-[0.35] mask-radial" />
			</div>

			<PageShell>
				<Link
					href="/"
					className="flex w-fit min-h-11 items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors duration-200 ease-out mb-8"
				>
					<ArrowLeft className="h-4 w-4" aria-hidden="true" />
					Home
				</Link>

				<span className="section-eyebrow-caps">Help center</span>
				<h1 className="display-headline mt-3 text-text-bright">FAQ</h1>
				<p className="page-intro max-w-2xl">
					Plain-language answers for people who have never used an AI API —
					and links for developers who want the deep detail. New to all of
					this? Start at <Link href="/getting-started" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">getting started</Link> or the{" "}
					<Link href="/glossary" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">glossary</Link>.
				</p>

				<div className="mt-10">
					<FAQContent groups={FAQ_GROUPS} />
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
			</PageShell>
		</div>
	);
}
