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
	*
	* URLs are resolved from env at request time so staging / preview
	* deployments advertise the right host instead of leaking prod URLs.
	*/
import { DEFAULT_API_URL } from "@/lib/config";

export const dynamic = "force-static";
export const revalidate = 3600;

function resolveSiteUrl(): string {
	return (
		process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://oma-ai.com"
	);
}

export function GET(): Response {
	const siteUrl = resolveSiteUrl();
	const apiUrl =
		DEFAULT_API_URL?.replace(/\/+$/, "") || "https://api.oma-ai.com";

	const BODY = `# OMA AI — Open Model Access

> One gateway. Every model. No lock-in. OpenAI-compatible multi-provider AI inference with 21 curated chat models, x402 USDC micropayments on Base, and privacy-first routing.

## Docs

- [Getting Started](${siteUrl}/getting-started)
- [API Reference](${siteUrl}/docs): [Authentication](${siteUrl}/docs#authentication), [Endpoints](${siteUrl}/docs#endpoints), [Available Models](${siteUrl}/docs#models), [Provider Routing](${siteUrl}/docs#provider-routing), [Streaming](${siteUrl}/docs#streaming), [Rate Limits](${siteUrl}/docs#rate-limits), [Pricing](${siteUrl}/docs#pricing), [x402 Payments](${siteUrl}/docs#x402), [SDKs](${siteUrl}/docs#sdks), [Error Codes](${siteUrl}/docs#errors)
- [FAQ](${siteUrl}/faq)
- [Glossary](${siteUrl}/glossary)

## Product

- [Home](${siteUrl}/)
- [Models](${siteUrl}/models)
- [Pricing](${siteUrl}/pricing)
- [Chat Playground](${siteUrl}/chat)

## Authenticated product surfaces

- [Deposit](${siteUrl}/deposit): sign-in required to fund account credits.

## Company

- [About](${siteUrl}/about)
- [Contact](${siteUrl}/contact)
- [Privacy](${siteUrl}/privacy)
- [Terms](${siteUrl}/terms)

## Agent resources

- [Agent skill (autonomous setup instructions)](${siteUrl}/agent-skill.md)
- [A2A agent card](${siteUrl}/.well-known/agent-card.json)
- [OpenAPI spec](${apiUrl}/v1/openapi)
- [Model catalog](${apiUrl}/v1/models)
- [GitHub](https://github.com/NosytLabs)
`;

	return new Response(BODY, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=3600",
			Link: `<${siteUrl}/llms.txt>; rel="canonical"`,
		},
	});
}
