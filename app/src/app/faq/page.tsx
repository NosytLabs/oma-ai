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
		locale: "en_US",
		title: "FAQ — OMA AI, explained simply",
		description:
			"Do I need a wallet? What is an API key? What is a token? Plain-language answers to the questions everyone asks.",
		url: "/faq",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA FAQ" }],
	},
	robots: { index: true, follow: true },
};

const FAQ_GROUPS: { heading: string; items: { q: string; a: string }[] }[] = [
	{
		heading: "Using OMA with your tools",
		items: [
			{
				q: "Can I use OMA inside Claude Code, OpenCode, or Cursor?",
				a: `Yes. Use the tool-specific setup at /docs#integrations with your oma_sk_... key, then choose an available catalog model. OpenAI-compatible tools use https://www.oma-ai.com/api/v1; the Claude Code guide uses OMA's Anthropic-compatible endpoint. OpenCode, Claude Code, Cursor, and Continue are covered in the docs.`,
			},
			{
				q: "How do I migrate an app that already uses OpenAI?",
				a: `You keep your request shape and SDK. Change one thing — the base URL is now https://www.oma-ai.com/api/v1 — swap the key, and specify an OMA catalog model per request. The openai-python package, Vercel AI SDK, and anything else that speaks OpenAI's API work as-is.`,
			},
			{
				q: "Does OMA support the Anthropic Messages API?",
				a: `Yes — OMA exposes an Anthropic-compatible Messages endpoint alongside the OpenAI-compatible /chat/completions path, so tools written against the Anthropic SDK can also point at OMA with the same key. See /docs#endpoints for the exact paths and request shapes.`,
			},
		],
	},
	{
		heading: "Reliability & safety",
		items: [
			{
				q: "How does OMA handle provider outages?",
				a: `A circuit breaker keeps traffic off an unhealthy upstream route. If the requested model has a configured fallback, OMA can retry that mapped model on the fallback route; otherwise the request returns an upstream/unavailable error rather than silently swapping to a different model. Check /status for live gateway health.`,
			},
			{
				q: "Can a provider see my prompts?",
				a: `OMA itself does not persist prompt or completion content and meters only billing metadata. However, the inference provider that serves a request must process that content to answer it, so provider-side retention guarantees depend on the model and provider you select. See /privacy for the exact data-flow.`,
			},
			{
				q: "What are the rate limits?",
				a: `There are no per-plan rate tiers; a single shared token-bucket set applies, with per-model overrides where a provider needs them (for example llama-3.3-70b). The docs list the burst, refill, sustained RPM, and per-model token ceilings at /docs#rate-limits. Rate-limit headers are returned on each response.`,
			},
		],
	},
	{
		heading: "Getting started",
		items: [
			{
				q: "What is OMA?",
				a: `OMA (Open Model Access) is a single place to use many AI models. Instead of signing up for ten different AI companies, you get one account, one API key, and one way to pay. It works exactly like OpenAI's API, so almost any AI app or tool that supports OpenAI already works with OMA.`,
			},
			{
				q: "Do I need to know how to code?",
				a: "No. You can try AI immediately in the free chat playground at /chat — no account needed. Guests can use the three OMA-AI website-chat models (DeepSeek V4 Flash, MiniMax M2.7, and GLM-5.3 Flash) with a daily message cap. You only need the API (and an API key) when you want to build something, like an app or a script.",
			},
			{
				q: "How do I start using it?",
				a: `Three steps: (1) try free website chat on the three OMA-AI models — no account needed; (2) sign in with your email (magic link) or crypto wallet and create an API key; (3) add a little credit and call the API. The full walkthrough is on the /getting-started page.`,
			},
			{
				q: "What can I do with it?",
				a: `Chat, write code, summarize documents, analyze data, work with image inputs, and more — across ${MODEL_COUNT} models from many providers through one API.`,
			},
			{
				q: "Is there a free tier?",
				a: "Yes. Website chat has a daily free allowance on eligible OMA-AI models, subject to availability, with more messages once you sign in. Any signup credit depends on the current offer and is shown in your account. API-key calls always spend credits, even on those models; the free tier lives in browser chat. See /pricing for limits.",
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
				q: "Do you store my API keys?",
				a: "Only the SHA-256 hash of your key is stored — not the key itself. The plaintext `oma_sk_...` is shown once when you create it and can't be viewed again; if you lose it, just revoke and create a new one. Keys are tied to your account and can be revoked instantly from the dashboard. OMA does not persist prompt or completion content. See /privacy for the full detail.",
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
				a: "OMA itself does not persist prompt or completion content. The inference provider that serves a request must process that content, and provider retention/privacy guarantees depend on the selected provider and model. See /privacy for the data-flow details.",
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
				a: "USDC is a U.S.-dollar-denominated stablecoin issued by Circle. It aims to track $1, though its market price can vary. Base is the blockchain network where OMA accepts USDC payments. See /glossary for more detail.",
			},
			{
				q: "What is x402?",
				a: "x402 is a crypto payment flow for agents: sign a USDC authorization on Base, verify at /x402/verify, settle to credit your account, then call the API with your key. Inference itself is billed from that credit balance — not attached as a mid-request 402 on chat today.",
			},
			{
				q: "How much does it cost?",
				a: "API cost depends on the selected model and the number of input and output tokens. Rates are quoted per million tokens, with no subscription or monthly fee. Website chat has a separate daily free allowance on eligible models. See /pricing for current rates and limits.",
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
				a: "A model is a specific AI system with different strengths, context limits, and prices. You pick the model id per request; OMA routes that requested model to its configured upstream provider.",
			},
			{
				q: "What is a token?",
				a: "A token is roughly a piece of a word — 'hello' is about one token, 'hello world' about two. AI prices and limits are measured in tokens (and you'll see 'tokens per second' while chatting). A typical English word is 1–2 tokens.",
			},
			{
				q: "What is a context window?",
				a: "The context window is how much text a model can see at once — your whole conversation plus the answer. OMA-AI models currently span 200K to 1M tokens, and several Venice-routed models also reach 1M. Each model page shows its exact limit.",
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
				a: "Some catalog models accept image inputs alongside text. Check the model page or capability filters before relying on vision support. Compatible models use the OpenAI multimodal `messages[].content` array shape (for example text and image_url parts).",
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
				a: "Yes. /agent-skill.md explains how to sign in, create an API key, discover available models, and make a request. It also documents optional x402 funding, which requires the payer's wallet session and moves real funds. OMA publishes an agent card at /.well-known/agent-card.json and a machine-readable index at /llms.txt.",
			},
			{
				q: "What happens when a model provider is down?",
				a: "The circuit breaker stops repeatedly sending traffic to an unhealthy route. If the requested model has a configured fallback, OMA can retry that mapped model there. If no fallback is configured, the request can return an upstream/unavailable error rather than silently substituting a different model.",
			},
			{
				q: "I got a 402 error — what now?",
				a: "A 402 means payment is required — usually your credit balance is empty. Top up at /deposit (USDC or card when enabled), or use the x402 verify/settle flow to credit your balance, then retry with an API key (docs: /docs#x402).",
			},
			{
				q: "How do I troubleshoot x402 errors?",
				a: "Check the Base network, USDC balance, current treasury recipient, signature fields, validity window, and a fresh nonce. EIP-3009 uses a signed transfer authorization; a separate token approval is not required. Settlement needs a SIWE session for the same wallet that paid. If a transaction hash was returned, check it before authorizing another transfer. See /docs#x402 for the full flow.",
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
					Plain-language answers for people who have never used an AI API,
					plus links for developers who want the deeper detail. New to all of
					this? Start at <Link href="/getting-started" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">getting started</Link> or the{" "}
					<Link href="/glossary" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">glossary</Link>.
				</p>

				<div className="mt-10">
					<FAQContent groups={FAQ_GROUPS} />
				</div>

				<div className="mt-12 rounded-[var(--radius-lg)] border border-accent/25 bg-accent/5 p-5 text-sm text-text-secondary">
					<p className="font-semibold text-text-bright mb-1">Still stuck?</p>
					<p>
						Reach us at <Link href="/contact" className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">/contact</Link>: real
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
