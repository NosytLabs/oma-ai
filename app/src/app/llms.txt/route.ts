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
	* URLs are resolved from env when generated so staging / preview
	* deployments advertise the right host instead of leaking prod URLs.
	*/
import SITE_URL from "@/lib/site";

export const dynamic = "force-static";
export const revalidate = 3600;

export function GET(): Response {
	const siteUrl = SITE_URL;

	// NEXT_PUBLIC_API_URL points at the Neon function's own hostname, which is
	// infrastructure, not the public API. Advertising it in llms.txt hands
	// agents an internal origin that is not what the docs tell developers to
	// use, and it changes if the branch is ever recreated. The canonical
	// public API is the same-origin proxy: <site>/api.
	const publicApiUrl = `${siteUrl}/api`;

	const BODY = `# OMA AI — Open Model Access

> Chat Completions and a text/function-tool Messages adapter across a curated model catalog, with prepaid credits and USDC funding on Base. Check the live catalog for current availability, capabilities, and prices.

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
- [API discovery metadata](${siteUrl}/.well-known/agent-card.json)
- [OpenAPI spec](${publicApiUrl}/v1/openapi.json)
- [Model catalog](${publicApiUrl}/v1/models): live availability and prices; an unavailable model remains listed for reference.
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
