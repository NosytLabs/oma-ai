import { NextResponse } from "next/server";
import { MODEL_COUNT } from "@/lib/models-data";

export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * Well-known A2A Agent Card for OMA.
 *
 * Implements the A2A v0.3 / Bazaar discovery shape: each `skills[]` entry
 * advertises `inputModes` + `outputModes` + tags so agent directories and
 * tool-using models can route themselves to the right endpoint without a
 * follow-up probe request. The x402 payment block mirrors the v2 spec so
 * the card is self-describing for the pay-per-request flow.
 */
const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const FALLBACK_TREASURY = "0x8581784D3E598cCa3482375CFF2409Ac9DD8c402";
const MODEL_COUNT_LABEL = `${MODEL_COUNT}+`;

export async function GET() {
	const payee = process.env.TREASURY_BASE_ADDRESS || FALLBACK_TREASURY;

	const agentCard = {
		name: "OMA AI Gateway",
		description: `Permissionless AI inference across ${MODEL_COUNT_LABEL} models. Buy credits with card, deposit USDC on Base, or let agents pay per request in USDC via x402. OpenAI-compatible endpoint, privacy-first routing, A2UI-ready responses.`,
		url: "https://oma-ai.com/.well-known/agent-card.json",
		version: "2.1.0",
		documentation: "https://oma-ai.com/docs",
		provider: {
			organization: "NosytLabs",
			url: "https://nosytlabs.com",
		},
		capabilities: {
			streaming: true,
			pushNotifications: false,
			stateTransitionHistory: false,
			a2ui: true,
		},
		authentication: {
			schemes: ["siwe", "account-number", "api-key", "magic-link"],
			description:
				"Sign in with Ethereum (EIP-4361) for wallet-bound sessions, magic-link email for human sign-in, or use a server-issued API key (`oma_sk_...`) for machine-to-machine calls.",
		},
		defaultInputModes: ["text", "image"],
		defaultOutputModes: [
			"text",
			"application/a2ui+json",
		],
		skills: [
			{
				id: "chat-completions",
				name: "Chat Completions",
				description: `OpenAI-compatible chat across ${MODEL_COUNT_LABEL} models: frontier, premium, mid, and budget tiers. Streaming + tool/function calling + system prompts + JSON mode + multimodal input.`,
				tags: [
					"openai-compatible",
					"chat",
					"multimodal",
					"streaming",
					"tool-calling",
					"json-mode",
				],
				inputModes: ["text", "image"],
				outputModes: ["text", "application/a2ui+json"],
				endpoint: "https://api.oma-ai.com/v1/chat/completions",
				examples: [
					{
						input: { model: "llama-3.3-70b", messages: [{ role: "user", content: "Say hi in one short sentence." }], max_tokens: 32 },
						output: { choices: [{ message: { role: "assistant", content: "Hey there — welcome to OMA." } }] },
					},
				],
			},
			{
				id: "anthropic-messages",
				name: "Anthropic Messages API",
				description: "Anthropic-compatible /v1/messages endpoint. Translates Anthropic Messages API to OpenAI internally, routes through the same provider pool, and translates the response back to Anthropic shape.",
				tags: ["anthropic-compatible", "chat", "multimodal"],
				inputModes: ["text", "image"],
				outputModes: ["text"],
				endpoint: "https://api.oma-ai.com/v1/messages",
			},
			{
				id: "x402-pay-per-request",
				name: "x402 Pay-Per-Request (agent billing)",
				description: "Agents pay for a single request in USDC on Base via EIP-3009 transferWithAuthorization. No account, no API key, no subscription — the gateway replies 402 with a PAYMENT-REQUIRED challenge, the agent signs and retries with PAYMENT-SIGNATURE.",
				tags: [
					"x402",
					"agentic-billing",
					"usdc",
					"base",
					"eip-3009",
					"http-402",
					"no-account",
				],
				inputModes: ["text"],
				outputModes: ["text", "application/a2ui+json"],
				endpoint: "https://api.oma-ai.com/x402/verify",
				payment: {
					protocol: "x402",
					version: 2,
					network: "base-mainnet",
					caip2: "eip155:8453",
					asset: "USDC",
					assetAddress: USDC_BASE_MAINNET,
					payee,
					scheme: "exact",
					description:
						"Gasless EIP-3009 transferWithAuthorization. The agent signs the payment; the gateway pays gas and settles on-chain.",
				},
			},
			{
				id: "web-search",
				name: "Web Search",
				description: "Web search used by the chat playground to ground answers in real-time data. Query via GET; the chat UI attaches the results as context.",
				tags: ["search", "real-time", "grounding"],
				inputModes: ["text"],
				outputModes: ["text"],
				endpoint: "https://api.oma-ai.com/v1/search",
			},
		],
		payment: {
			protocol: "x402",
			version: 2,
			network: "base-mainnet",
			caip2: "eip155:8453",
			asset: "USDC",
			assetAddress: USDC_BASE_MAINNET,
			payee,
			scheme: "exact",
			endpoint: "/x402/verify",
			settlement: "/x402/settle",
		},
		rateLimits: {
			anonymous: "20 requests/day on the website chat (free models only)",
			authenticated: "100 requests/day on the website chat (free models)",
			apiKey: "Token bucket per key; see /docs#rate-limits",
		},
		discovery: {
			llmsTxt: "https://oma-ai.com/llms.txt",
			agentSkill: "https://oma-ai.com/agent-skill.md",
			openapi: "https://api.oma-ai.com/v1/openapi",
			models: "https://api.oma-ai.com/v1/models",
		},
		contact: "support@nosytlabs.com",
		license: "MIT",
	};
	return NextResponse.json(agentCard, {
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
