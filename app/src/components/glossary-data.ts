export interface GlossaryTerm {
	term: string;
	aka?: string;
	def: string;
}

export const TERMS: GlossaryTerm[] = [
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
		def: "A unit a model uses to process input and output. The count depends on the selected model and content. OMA quotes API prices per million tokens and records provider-reported usage.",
	},
	{
		term: "Context window",
		def: "How much text a model can see at once — your whole conversation, pasted documents, and its answer. The model catalog lists configured context and output limits with their verification sources.",
	},
	{
		term: "Model",
		def: "A trained AI 'brain' with specific strengths, speeds, and prices. OMA routes to a curated catalog of chat models from multiple upstream providers — frontier for hard problems, budget for everyday chat.",
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
		def: "Receiving incremental response chunks as the model generates them. OMA uses server-sent events for streaming API responses.",
	},
	{
		term: "Provider",
		def: "The upstream service or network that actually handles a model request. OMA is the gateway in front of these routes, so the same API contract can be used across the catalog.",
	},
	{
		term: "Gateway",
		def: "A single front door to many models and providers. You call one API; OMA maps the requested model to its configured upstream, meters the request, and uses circuit-breaker protection plus a configured fallback where one exists.",
	},
	{
		term: "OpenAI-compatible",
		def: "Support for the documented Chat Completions request and response shapes at /api/v1. Configure an OMA key and model ID, and check /docs for supported fields. OMA does not implement the Responses API.",
	},
	{
		term: "Embedding",
		def: "Turning text into a list of numbers (a vector) that captures its meaning, so programs can compare, search, and cluster text by similarity. Used for search, recommendations, and memory. OMA doesn't currently expose an embeddings endpoint — this is here for context.",
	},
	{
		term: "Temperature / top-p",
		def: "Sampling controls accepted by the Chat Completions API. Their effect depends on the selected model and provider; see the request bounds in /docs.",
	},
	{
		term: "Latency",
		def: "The delay before the model starts answering. Low latency = the first token arrives fast; throughput = how many tokens per second after that.",
	},
	{
		term: "Rate limit",
		def: "A cap on how many requests you can send in a time window, protecting the service (and your balance) from runaway loops. OMA applies account, key, IP and model limits; see /docs#rate-limits.",
	},
	{
		term: "HTTP status 402",
		def: "Payment Required — usually means your credit balance is too low for the request. On OMA, paid API calls require a credit reservation before provider work. Free website chat has separate quotas. x402 funding is a separate operation.",
	},
	{
		term: "Credits",
		def: "OMA's prepaid balance, denominated in credits. Deposit USDC (or use card checkout when Polar is enabled); paid requests reserve a maximum budget, then settle verified usage and return unused credit. Uncertain outcomes can retain a hold for review.",
	},
	{
		term: "USDC",
		def: "A U.S.-dollar-denominated stablecoin issued by Circle. Its market price is designed to track one U.S. dollar, and OMA uses USDC on Base for deposits and agent settlement.",
	},
	{
		term: "Base",
		def: "An Ethereum layer-2 network incubated by Coinbase, where OMA settles USDC deposits and x402 settlements. Network fees are generally lower than Ethereum mainnet but can vary.",
	},
	{
		term: "Wallet",
		def: "Software that holds your crypto and proves ownership with signatures. Used on OMA for wallet sign-in (SIWE) and the x402 settlement flow.",
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
		def: "An open HTTP payment standard OMA uses for agent USDC funding on Base: verify a signed EIP-3009 authorization, settle to credit your balance, then spend with an API key. See /docs#x402.",
	},
	{
		term: "EIP-3009",
		def: "The Ethereum standard OMA uses for x402 settlements: transferWithAuthorization lets a wallet sign a gasless USDC transfer — the payer pays no gas fee because the gateway covers it.",
	},
	{
		term: "Gas (fee)",
		def: "The small fee paid to a blockchain for processing a transaction. OMA's x402 facilitator pays gas for relayed authorizations. Direct wallet deposits require gas in the sending wallet.",
	},
	{
		term: "SDK",
		def: "Software Development Kit — a ready-made library (Python, Node, etc.) so you don't hand-write HTTP calls. Use a client that supports a configurable Chat Completions base URL, API key and model. Check the documented subset before relying on client-specific features.",
	},
	{
		term: "MCP",
		def: "Model Context Protocol — a standard way to give AI models access to tools and data (files, browsers, databases). OMA chat completions accept OpenAI-style tool calls so MCP-aware clients can route tool use through the same /v1/chat/completions endpoint.",
	},
	{
		term: "A2UI",
		def: "Agent-to-User Interface — an open, JSON-based streaming protocol for agents to describe portable UI that a host app renders with its own components. OMA retains a legacy renderer for saved A2UI-shaped output. The current website UI mode uses OpenUI; this does not add an A2UI response format to the API.",
	},
	{
		term: "llms.txt",
		def: "A simple text file at a site's root that tells AI tools (crawlers, agents) what the site is and where its docs live. OMA publishes one at /llms.txt.",
	},
	{
		term: "Agent skill",
		def: "A plain-text instruction file an AI agent can read to learn how to do something autonomously. OMA publishes /agent-skill.md with API setup, authentication requirements, request examples and optional wallet funding instructions.",
	},
	{
		term: "Zero data retention",
		def: "A policy term meaning request content is not retained after processing. OMA does not persist prompt or completion content itself, but the upstream inference provider that handles a request must process that content and its own retention and privacy terms still matter.",
	},
];

export type GlossarySlug =
	typeof GLOSSARY_SLUGS[number];

export const GLOSSARY_SLUGS = [
	"api", "api-key", "token", "context-window", "model", "prompt", "inference",
	"streaming", "provider", "gateway", "openai-compatible", "embedding",
	"temperature-top-p", "latency", "rate-limit", "http-status-402", "credits",
	"usdc", "base", "wallet", "siwe", "magic-link", "x402", "eip-3009",
	"gas-fee", "sdk", "mcp", "a2ui", "llms-txt", "agent-skill",
	"zero-data-retention",
] as const;

export function slugifyTerm(term: string): GlossarySlug {
	// Collapse any run of non-alphanumerics (spaces, slashes, parentheses…)
	// into a single dash — "Temperature / top-p" -> "temperature-top-p",
	// "Gas (fee)" -> "gas-fee" — so it agrees with the hand-authored
	// GLOSSARY_SLUGS entries.
	const slug = term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
	if (!GLOSSARY_SLUGS.includes(slug as GlossarySlug)) {
		throw new Error(`Missing glossary slug mapping for ${term}`);
	}
	return slug as GlossarySlug;
}

export const GLOSSARY_TERMS_BY_SLUG: Record<GlossarySlug, GlossaryTerm> = Object.fromEntries(
	TERMS.map((entry) => [slugifyTerm(entry.term), entry]),
) as Record<GlossarySlug, GlossaryTerm>;

export const RELATED_TERMS: Record<GlossarySlug, readonly GlossarySlug[]> = {
	api: ["api-key", "sdk", "openai-compatible"], "api-key": ["api", "credits", "rate-limit"],
	token: ["context-window", "prompt", "credits"], "context-window": ["token", "model", "prompt"],
	model: ["provider", "gateway", "context-window"], prompt: ["token", "inference", "context-window"],
	inference: ["model", "prompt", "latency"], streaming: ["latency", "token", "api"],
	provider: ["model", "gateway", "latency"], gateway: ["api", "provider", "model"],
	"openai-compatible": ["api", "sdk", "gateway"], embedding: ["token", "model", "inference"],
	"temperature-top-p": ["inference", "token", "prompt"], latency: ["streaming", "provider", "rate-limit"],
	"rate-limit": ["api-key", "latency", "credits"], "http-status-402": ["credits", "x402", "usdc"],
	credits: ["usdc", "api-key", "http-status-402"], usdc: ["base", "credits", "x402"],
	base: ["usdc", "wallet", "x402"], wallet: ["siwe", "base", "gas-fee"],
	siwe: ["wallet", "magic-link", "base"], "magic-link": ["siwe", "api-key", "wallet"],
	x402: ["http-status-402", "usdc", "eip-3009"], "eip-3009": ["x402", "gas-fee", "usdc"],
	"gas-fee": ["base", "eip-3009", "wallet"], sdk: ["api", "openai-compatible", "mcp"],
	mcp: ["api", "a2ui", "sdk"],
	a2ui: ["sdk", "mcp", "streaming"], "llms-txt": ["agent-skill", "sdk", "api"],
	"agent-skill": ["api", "llms-txt", "api-key"], "zero-data-retention": ["api-key", "prompt", "credits"],
};
