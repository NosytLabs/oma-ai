import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FloatingIcons } from "@/components/floating-icons";
import { InViewFade } from "@/components/motion/in-view-fade";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
	title: "Glossary — AI & crypto terms, explained",
	description:
		"Every term you'll meet on OMA explained in plain language: token, context window, API key, USDC, Base, x402, streaming, embedding, and more.",
	alternates: { canonical: "/glossary" },
	openGraph: {
		title: "Glossary — AI & crypto terms, explained",
		description:
			"Token? Context window? USDC? x402? A jargon-free dictionary for the AI API world.",
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA Glossary" }],
	},
	robots: { index: true, follow: true },
};

interface Term {
	term: string;
	aka?: string;
	def: string;
}

const TERMS: Term[] = [
	{
		term: "API",
		def: "A way for programs to talk to each other. The OMA API lets your code send a message to an AI model and get an answer back, the same way a website's backend talks to its frontend.",
	},
	{
		term: "API key",
		def: "A secret code (it looks like oma_sk_...) that identifies you when your code calls the API. It's like a password for your credit balance — keep it private, and you can create or revoke keys anytime in the dashboard.",
	},
	{
		term: "Token",
		def: "A unit of text that AI models read and write. Roughly 1 token = ¾ of a word in English. Prices, speeds, and limits are all measured in tokens.",
	},
	{
		term: "Context window",
		def: "How much text a model can see at once — your whole conversation, pasted documents, and its answer. OMA offers models with up to 1M+ token windows: enough to read an entire book in one go.",
	},
	{
		term: "Model",
		def: "A trained AI 'brain' with specific strengths, speeds, and prices. OMA routes to a curated catalog of chat, image, video, and audio models from multiple upstream providers — frontier for hard problems, budget for everyday chat.",
	},
	{
		term: "Prompt",
		def: "The instructions or question you give to a model. A good prompt is clear and specific; that's the whole job of 'prompt engineering'.",
	},
	{
		term: "Inference",
		def: "The act of a model generating an answer (as opposed to training, which is how it learned). Every time you chat, the API runs one inference.",
	},
	{
		term: "Streaming",
		def: "Sending the answer word-by-word as it's generated, instead of waiting for the complete reply. Feels instant; standard in chat apps.",
	},
	{
		term: "Provider",
		def: "The company that actually runs the model hardware — e.g. the labs behind the models OMA routes to. OMA is the gateway in front of them all, so one API works across providers.",
	},
	{
		term: "Gateway",
		def: "A single front door to many models and providers. You call one API; the gateway picks the best provider, handles failures (circuit-breaker failover), and bills you once.",
	},
	{
		term: "OpenAI-compatible",
		def: "Speaking the same API language as OpenAI. Tools, SDKs, and tutorials written for OpenAI work with OMA by just changing the base URL to https://api.oma-ai.com/v1.",
	},
	{
		term: "Embedding",
		def: "Turning text into a list of numbers (a vector) that captures its meaning, so programs can compare, search, and cluster text by similarity. Used for search, recommendations, and memory.",
	},
	{
		term: "Temperature / top-p",
		def: "Knobs that control randomness. Lower = more predictable and factual; higher = more creative. Top-p is an alternative way of dialing the same thing. OMA lets you tune both per request.",
	},
	{
		term: "Latency",
		def: "The delay before the model starts answering. Low latency = the first token arrives fast; throughput = how many tokens per second after that.",
	},
	{
		term: "Rate limit",
		def: "A cap on how many requests you can send in a time window, protecting the service (and your balance) from runaway loops. OMA enforces per-key limits; see /docs#rate-limits.",
	},
	{
		term: "HTTP status 402",
		def: "Payment Required — the API's polite way of saying 'I need payment to fulfill this'. Either your credits ran out or the x402 flow wants a signed payment before it serves the request.",
	},
	{
		term: "Credits",
		def: "OMA's prepaid balance, denominated in USDC. Buy with a card or deposit USDC; each request deducts its cost. Credits never expire.",
	},
	{
		term: "USDC",
		def: "A stablecoin: a digital token that always equals 1 US dollar, issued by regulated companies. It lets money move automatically over blockchains.",
	},
	{
		term: "Base",
		def: "A fast, cheap Ethereum layer-2 blockchain built by Coinbase, where OMA settles USDC payments. Fees are pennies, so per-request payments make sense.",
	},
	{
		term: "Wallet",
		def: "Software that holds your crypto and proves ownership with signatures. Used on OMA for wallet sign-in (SIWE) and the x402 pay-per-request flow.",
	},
	{
		term: "SIWE",
		def: "Sign-In With Ethereum — a standard that lets you sign in to a website using your wallet instead of an email and password. Optional on OMA; email magic link also works.",
	},
	{
		term: "Magic link",
		def: "Password-free sign-in: we email you a link, you click it, you're in. No password manager needed.",
	},
	{
		term: "x402",
		def: "An open standard for paying for a single HTTP request with crypto, automatically (like a vending machine for AI). The API replies 'pay X USDC', your agent signs the payment, the request proceeds. See /docs#x402.",
	},
	{
		term: "EIP-3009",
		def: "The Ethereum standard OMA uses for x402 payments: transferWithAuthorization lets a wallet sign a gasless USDC transfer — the payer pays no gas fee because the gateway covers it.",
	},
	{
		term: "Gas (fee)",
		def: "The small fee paid to a blockchain for processing a transaction. EIP-3009 transfers on OMA are gasless for you — the gateway pays the gas.",
	},
	{
		term: "SDK",
		def: "Software Development Kit — a ready-made library (Python, Node, etc.) so you don't hand-write HTTP calls. OpenAI's SDKs work with OMA by pointing them at our base URL.",
	},
	{
		term: "MCP",
		def: "Model Context Protocol — a standard way to give AI models access to tools and data (files, browsers, databases). OMA supports MCP-style tool calls in chat completions. To use MCP with OMA, configure your MCP client (like Trae or Claude Desktop) to use an SSE transport connecting to https://api.oma-ai.com/v1/mcp.",
	},
	{
		term: "A2A",
		def: "Agent-to-Agent — an open protocol (now a W3C standard) for AI agents to discover and talk to each other. OMA publishes an A2A agent card at /.well-known/agent-card.json so agents can learn how to use it autonomously.",
	},
	{
		term: "A2UI",
		def: "Agent-to-User Interface — an open protocol for models to render interactive UI (buttons, forms, cards) inside chat apps. Enable UI mode in the OMA playground and ask for a form to see it live.",
	},
	{
		term: "llms.txt",
		def: "A simple text file at a site's root that tells AI tools (crawlers, agents) what the site is and where its docs live. OMA publishes one at /llms.txt.",
	},
	{
		term: "Agent skill",
		def: "A plain-text instruction file an AI agent can read to learn how to do something autonomously. OMA publishes /agent-skill.md so agents can create an account and start calling the API by themselves.",
	},
	{
		term: "Zero data retention",
		def: "OMA's privacy stance: your prompt and completion content are not logged or stored. Usage is metered for billing only.",
	},
];

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export default function GlossaryPage() {
	const byLetter = new Map<string, Term[]>();
	for (const t of TERMS) {
		const letter = t.term[0]!.toUpperCase();
		if (!byLetter.has(letter)) byLetter.set(letter, []);
		byLetter.get(letter)!.push(t);
	}
	return (
		<div className="relative min-h-screen bg-void text-text overflow-hidden">
			<BreadcrumbListJsonLd items={[{ name: "Home", url: "/" }, { name: "Glossary", url: "/glossary" }]} />
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

				<span className="page-kicker">Reference</span>
				<h1 className="display-headline mt-3 text-text-bright">Glossary</h1>
				<p className="page-intro mt-4 max-w-2xl">
					Every term you&apos;ll meet on OMA, explained without jargon — from
					tokens and context windows to USDC and x402. New here? Pair this
					with the <Link href="/faq" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">FAQ</Link> and{""}
					<Link href="/getting-started" className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent">getting started</Link> guide.
				</p>

				<nav aria-label="Glossary letters" className="mt-8 flex flex-wrap gap-1.5">
					{LETTERS.split("").map((l) => (
						<a
							key={l}
							href={`#${l.toLowerCase()}`}
							className={`inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border text-xs font-mono transition-colors duration-200 ease-out ${
								byLetter.has(l)
									? "border-accent/40 text-accent hover:bg-accent/10"
									: "border-border text-text-muted/40 pointer-events-none"
							}`}
						>
							{l}
						</a>
					))}
				</nav>

				<div className="mt-10 space-y-10">
					{LETTERS.split("").map((l, li) => {
						const items = byLetter.get(l);
						if (!items) return null;
						return (
							<InViewFade key={l} delay={Math.min(li * 0.04, 0.2)}>
								<section aria-labelledby={`letter-${l.toLowerCase()}`} id={`${l.toLowerCase()}`} className="scroll-mt-24">
									<h2
										id={`letter-${l.toLowerCase()}`}
										className="text-sm font-mono font-bold uppercase tracking-wider text-accent mb-4"
									>
										{l}
									</h2>
									<dl className="space-y-4">
										{items.map((t) => (
											<div key={t.term} className="border-l-2 border-border pl-4">
												<dt className="text-sm font-semibold text-text-bright">
													{t.term}
													{t.aka && <span className="ml-2 text-xs font-mono text-text-muted">aka {t.aka}</span>}
												</dt>
												<dd className="mt-1 text-sm leading-relaxed text-text-secondary">{t.def}</dd>
											</div>
										))}
									</dl>
								</section>
							</InViewFade>
						);
					})}
				</div>
			</div>
		</div>
	);
}
