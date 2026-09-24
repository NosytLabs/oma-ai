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
import { MODEL_COUNT } from "@/lib/models-data";

export const dynamic = "force-static";
export const revalidate = 3600;

function resolveSiteUrl(): string {
	return (
		process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "https://www.oma-ai.com"
	);
}

export async function GET(): Promise<Response> {
	const siteUrl = resolveSiteUrl();
	const apiUrl =
		DEFAULT_API_URL?.replace(/\/+$/, "") || "https://www.oma-ai.com/api";

	// MODEL_COUNT is a compile-time constant (20) that overstates what is
	// actually callable. llms.txt is the primary discovery surface for LLM
	// crawlers, so quoting the static number here advertises models an agent
	// will get a 503 trying to call. Resolve the live count, and only fall
	// back to the static value if the catalog is unreachable.
	let modelCount = MODEL_COUNT;
	try {
		const res = await fetch(`${apiUrl}/v1/models`, {
			signal: AbortSignal.timeout(4_000),
			next: { revalidate: 900 },
		});
		if (res.ok) {
			const body = (await res.json()) as { data?: unknown };
			const rows = Array.isArray(body?.data) ? body.data : [];
			const live = rows.filter(
				(m) => (m as { available?: boolean })?.available !== false,
			);
			if (live.length > 0) modelCount = live.length;
		}
	} catch {
		/* catalog unreachable — keep the static fallback */
	}

	const BODY = `# OMA AI — Open Model Access

> One gateway. Every model. No lock-in. OpenAI-compatible multi-provider AI inference with ${modelCount} curated chat models, x402 USDC settlement on Base, and privacy-first routing.

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
