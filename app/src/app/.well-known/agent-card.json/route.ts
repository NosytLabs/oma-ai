import { NextResponse } from "next/server";
import SITE_URL from "@/lib/site";

export const dynamic = "force-static";
export const revalidate = 3600;

/**
	* Well-known A2A Agent Card for OMA.
	*
	* Implements the A2A v0.3 / Bazaar discovery shape: each `skills[]` entry
	* advertises `inputModes` + `outputModes` + tags so agent directories and
	* tool-using models can route themselves to the right endpoint without a
	* follow-up probe request. The x402 payment block mirrors the v2 spec so
	* the card is self-describing for the x402 settlement + credit spend flow.
	*/
const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export function GET() {
	const appUrl = SITE_URL;
	const apiUrl = `${appUrl}/api`;

	const agentCard = {
		name: "OMA AI Gateway",
		description: "OpenAI-compatible inference across a curated model catalog. Check live model availability and prices before requesting inference. Fund prepaid credits with USDC on Base, x402, or card checkout when available, then spend with an API key.",
		url: `${appUrl}/.well-known/agent-card.json`,
		version: "2.1.0",
		documentation: `${appUrl}/docs`,
		provider: {
			organization: "NosytLabs",
			url: "https://github.com/NosytLabs",
		},
		capabilities: {
			streaming: true,
			pushNotifications: false,
			stateTransitionHistory: false,
			a2ui: true,
		},
		authentication: {
			schemes: ["siwe", "api-key", "magic-link"],
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
				description: "OpenAI-compatible chat across frontier, premium, mid, and budget tiers. Availability, tool calling, JSON mode, and image-input support depend on the selected model; check the live catalog.",
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
				endpoint: `${apiUrl}/v1/chat/completions`,
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
				endpoint: `${apiUrl}/v1/messages`,
			},
			{
				id: "x402-settlement",
				name: "x402 Agent Settlement (USDC funding)",
				description: "Read the current recipient from GET /x402/info before signing. POST /x402/verify with PAYMENT-SIGNATURE broadcasts the EIP-3009 USDC transfer. Settle with the payer wallet's SIWE session to credit the balance, then spend with an API key. The facilitator pays gas.",
				tags: [
					"x402",
					"agentic-billing",
					"usdc",
					"base",
					"eip-3009",
					"credits",
					"api-key",
				],
				inputModes: ["text"],
				outputModes: ["text", "application/a2ui+json"],
				endpoint: `${appUrl}/x402/verify`,
				payment: {
					protocol: "x402",
					version: 2,
					network: "base-mainnet",
					caip2: "eip155:8453",
					asset: "USDC",
					assetAddress: USDC_BASE_MAINNET,
					discovery: `${appUrl}/x402/info`,
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
				endpoint: `${apiUrl}/v1/search`,
			},
		],
		payment: {
			protocol: "x402",
			version: 2,
			network: "base-mainnet",
			caip2: "eip155:8453",
			asset: "USDC",
			assetAddress: USDC_BASE_MAINNET,
			discovery: `${appUrl}/x402/info`,
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
			llmsTxt: `${appUrl}/llms.txt`,
			agentSkill: `${appUrl}/agent-skill.md`,
			openapi: `${apiUrl}/v1/openapi`,
			models: `${apiUrl}/v1/models`,
			paymentInfo: `${appUrl}/x402/info`,
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
