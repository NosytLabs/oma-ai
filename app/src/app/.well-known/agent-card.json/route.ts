import { NextResponse } from "next/server";
import SITE_URL from "@/lib/site";

export const dynamic = "force-static";
export const revalidate = 3600;

/** OMA API discovery metadata. The linked OpenAPI document defines each
 * supported request format; website UI renderers are not API protocols. */
const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export function GET() {
	const appUrl = SITE_URL;
	const apiUrl = `${appUrl}/api`;

	const agentCard = {
		name: "OMA AI Gateway",
		kind: "api-discovery",
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
		},
		authentication: {
			schemes: ["siwe", "api-key", "magic-link"],
			description:
				"Sign in with Ethereum (EIP-4361) for wallet-bound sessions, magic-link email for human sign-in, or use a server-issued API key (`oma_sk_...`) for machine-to-machine calls.",
		},
		defaultInputModes: ["text", "image"],
		defaultOutputModes: ["text"],
		skills: [
			{
				id: "chat-completions",
				name: "Chat Completions",
				description: "OpenAI-compatible chat across frontier, premium, mid, and budget tiers. Availability, tool calling and image-input support depend on the selected model. Only the documented request fields are forwarded; check the live catalog and OpenAPI contract.",
				tags: [
					"openai-compatible",
					"chat",
					"multimodal",
					"streaming",
					"tool-calling",
				],
				inputModes: ["text", "image"],
				outputModes: ["text"],
				endpoint: `${apiUrl}/v1/chat/completions`,
				examples: [
					{
						input: { model: "minimax-m2-7", messages: [{ role: "user", content: "Say hi in one short sentence." }], max_tokens: 32 },
						output: { choices: [{ message: { role: "assistant", content: "Hello from OMA." } }] },
					},
				],
			},
			{
				id: "anthropic-messages",
				name: "Anthropic Messages API",
				description: "Messages adapter for text and function tools. Image/document blocks are rejected; extended-thinking and prompt-cache fields are ignored and not forwarded. Uses the same prepaid balance and provider routing as Chat Completions.",
				tags: ["anthropic-compatible", "chat", "tool-calling"],
				inputModes: ["text"],
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
				outputModes: ["text"],
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
			apiKey: "Account, key, IP and model limits apply; see /docs#rate-limits",
		},
		discovery: {
			llmsTxt: `${appUrl}/llms.txt`,
			agentSkill: `${appUrl}/agent-skill.md`,
			openapi: `${apiUrl}/v1/openapi.json`,
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
