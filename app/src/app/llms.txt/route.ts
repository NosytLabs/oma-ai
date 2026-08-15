/**
	* /llms.txt — machine-readable site index for AI agents/crawlers.
	*
	* Spec: https://llmstxt.org/
	* Served from the app so it lives on the same origin as the docs and
	* never 404s for downstream agents (the file is referenced from the
	* agent-card.json, the README, the FAQ, and the glossary).
	*
	* Returns plain text per the spec — first line is the H1, optional
	* blockquote summary, then sections introduced by `## <Title>` with
	* a markdown list of links under each.
	*/
import type { NextResponse } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600;

const SITE_URL = "https://oma-ai.com";
const API_URL = "https://api.oma-ai.com";

const BODY = `# OMA AI — Open Model Access

> One gateway. Every model. No lock-in. OpenAI-compatible multi-provider AI inference with 26 curated chat models, x402 USDC micropayments on Base, and privacy-first routing.

## Docs

- [Getting Started](${SITE_URL}/getting-started)
- [API Reference](${SITE_URL}/docs): [Authentication](${SITE_URL}/docs#authentication), [Endpoints](${SITE_URL}/docs#endpoints), [Available Models](${SITE_URL}/docs#models), [Provider Routing](${SITE_URL}/docs#provider-routing), [Streaming](${SITE_URL}/docs#streaming), [Rate Limits](${SITE_URL}/docs#rate-limits), [Pricing](${SITE_URL}/docs#pricing), [x402 Payments](${SITE_URL}/docs#x402), [SDKs](${SITE_URL}/docs#sdks), [Error Codes](${SITE_URL}/docs#errors)
- [FAQ](${SITE_URL}/faq)
- [Glossary](${SITE_URL}/glossary)

## Product

- [Home](${SITE_URL}/)
- [Models](${SITE_URL}/models)
- [Pricing](${SITE_URL}/pricing)
- [Chat Playground](${SITE_URL}/chat)
- [Deposit](${SITE_URL}/deposit)

## Company

- [About](${SITE_URL}/about)
- [Contact](${SITE_URL}/contact)
- [Privacy](${SITE_URL}/privacy)
- [Terms](${SITE_URL}/terms)

## Agent resources

- [Agent skill (autonomous setup instructions)](${SITE_URL}/agent-skill.md)
- [A2A agent card](${SITE_URL}/.well-known/agent-card.json)
- [OpenAPI spec](${API_URL}/v1/openapi)
- [Model catalog](${API_URL}/v1/models)
- [GitHub](https://github.com/NosytLabs)
`;

export function GET(): Response {
	return new Response(BODY, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
