import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600;

/**
 * Well-known A2A Agent Card for OMA.
 *
 * Notes:
 *   - x402 is a *payment* protocol, not an auth scheme. The actual auth
 *     options are siwe and account-number, both surfaced under
 *     `authentication.schemes`. We still surface x402 under `payment` so
 *     clients that understand the protocol can self-document the
 *     per-request settlement flow.
 *   - The payee address is read from the server's TREASURY_BASE_ADDRESS
 *     env var so the card stays in sync with whatever the server actually
 *     settles to. Falls back to the production treasury address when the
 *     env is absent (e.g. when this file is statically rendered at build
 *     time on a host that does not load server-side env).
 *   - MODEL_COUNT_LABEL is the marketing claim surfaced in this card.
 *     The static fallback catalog in `lib/models-data.ts` only ships a
 *     small SSR snapshot (~11 hand-picked entries) so `MODEL_COUNT` would
 *     understate the live `/v1/models` catalog. Keep this label in sync
 *     with the upstream provider count when the catalog grows.
 */
const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const FALLBACK_TREASURY = "0x8581784D3E598cCa3482375CFF2409Ac9DD8c402";
const MODEL_COUNT_LABEL = "97+";

export async function GET() {
	const payee = process.env.TREASURY_BASE_ADDRESS || FALLBACK_TREASURY;

	const agentCard = {
		name: "OMA AI Gateway",
		description: `Permissionless AI inference across ${MODEL_COUNT_LABEL} models. Pay per request in USDC on Base via x402, or fund credits first via the credit-proxy flow.`,
		url: "https://oma-ai.com/.well-known/agent-card.json",
		version: "2.0.0",
		capabilities: {
			streaming: true,
			pushNotifications: false,
			stateTransitionHistory: false,
		},
		authentication: { schemes: ["siwe", "account-number"] },
		payment: {
			protocol: "x402",
			network: "base-mainnet",
			asset: "USDC",
			assetAddress: USDC_BASE_MAINNET,
			payee,
			endpoint: "/x402/verify",
		},
		defaultInputModes: ["text"],
		defaultOutputModes: ["text", "application/a2ui+json"],
		skills: [
			{
				id: "chat-completions",
				name: "Chat Completions",
				description: `OpenAI-compatible chat completions across ${MODEL_COUNT_LABEL} models`,
			},
			{
				id: "image-generation",
				name: "Image Generation",
				description: "Text-to-image generation",
			},
			{
				id: "video-generation",
				name: "Video Generation",
				description: "Text-to-video and image-to-video",
			},
			{
				id: "web-search",
				name: "Web Search",
				description: "Web search via Tinyfish MCP",
			},
		],
	};
	return NextResponse.json(agentCard, {
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
