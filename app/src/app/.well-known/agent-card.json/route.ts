import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET() {
	// ponytail: x402 is a *payment* protocol, not an auth scheme. The actual
	// auth options are siwe (Sign-In With Ethereum) and account-number.
	// Including 'x402' here would mislead A2A clients into thinking they can
	// pass a PAYMENT-SIGNATURE header as credentials (they can, but only as a
	// per-request settlement, not a session token). See docs/AUDIT-2026-06-18.md
	// critical issue U1 — we still surface x402 in `payment` so clients that
	// understand the protocol can self-document.
	const agentCard = {
		name: "OMA AI Gateway",
		description:
			"Permissionless AI inference across 95+ models. Pay per request in USDC on Base via x402, or fund credits first via the credit-proxy flow.",
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
			assetAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			payee: "0x8581784D3E598cCa3482375CFF2409Ac9DD8c402",
			endpoint: "/x402/verify",
		},
		defaultInputModes: ["text"],
		defaultOutputModes: ["text", "application/a2ui+json"],
		skills: [
			{
				id: "chat-completions",
				name: "Chat Completions",
				description: "OpenAI-compatible chat completions across 95+ models",
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
