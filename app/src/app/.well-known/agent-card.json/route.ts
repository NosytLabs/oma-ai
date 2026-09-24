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
	* the card is self-describing for the x402 settlement + credit spend flow.
	*/
const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const FALLBACK_TREASURY = "0x8581784D3E598cCa3482375CFF2409Ac9DD8c402";

/**
 * Prefer the live catalog count over the static MODEL_COUNT fallback.
 *
 * MODEL_COUNT is a compile-time constant (20) and overstates what is
 * actually callable, so any crawler-facing surface that prints it
 * advertises models a customer cannot call. This route is read by AI
 * agents, so it gets the real number. Falls back to the static value
 * only if the catalog is unreachable.
 */
async function liveModelCount(): Promise<number> {
	try {
		const base = (
			process.env.PUBLIC_API_URL ||
			process.env.NEXT_PUBLIC_PUBLIC_API_URL ||
			"https://www.oma-ai.com/api"
		).replace(/\/+$/, "");
		const res = await fetch(`${base}/v1/models`, {
			signal: AbortSignal.timeout(4_000),
			next: { revalidate: 900 },
		});
		if (!res.ok) return MODEL_COUNT;
		const body = (await res.json()) as { data?: unknown };
		const rows = Array.isArray(body?.data) ? body.data : [];
		const live = rows.filter((m) => {
			const model = m as { available?: boolean };
			return model?.available !== false;
		});
		return live.length > 0 ? live.length : MODEL_COUNT;
	} catch {
		return MODEL_COUNT;
	}
}

export async function GET() {
	const MODEL_COUNT_LIVE = await liveModelCount();
	const MODEL_COUNT_LABEL_LIVE = `${MODEL_COUNT_LIVE}`;
	const payee = process.env.TREASURY_BASE_ADDRESS || FALLBACK_TREASURY;
	const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.oma-ai.com").replace(/\/+$/, "");
	const apiUrl = (
		process.env.PUBLIC_API_URL ||
		process.env.NEXT_PUBLIC_PUBLIC_API_URL ||
		"https://www.oma-ai.com/api"
	).replace(/\/+$/, "");

	const agentCard = {
		name: "OMA AI Gateway",
		description: `Permissionless AI inference across ${MODEL_COUNT_LABEL_LIVE} models. Buy credits with card, deposit USDC on Base, or settle USDC via x402 then spend with an API key. OpenAI-compatible endpoint, privacy-first routing, A2UI-ready responses.`,
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
				description: `OpenAI-compatible chat across ${MODEL_COUNT_LABEL_LIVE} models: frontier, premium, mid, and budget tiers. Streaming + tool/function calling + system prompts + JSON mode + multimodal input.`,
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
				description: "Agents fund with USDC on Base via EIP-3009: verify with PAYMENT-SIGNATURE, settle from an authenticated session to credit a balance, then spend with an API key. Facilitator pays gas.",
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
				endpoint: `${apiUrl}/x402/verify`,
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
			llmsTxt: `${appUrl}/llms.txt`,
			agentSkill: `${appUrl}/agent-skill.md`,
			openapi: `${apiUrl}/v1/openapi`,
			models: `${apiUrl}/v1/models`,
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
