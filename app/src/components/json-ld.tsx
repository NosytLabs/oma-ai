/**
	* JSON-LD structured data for SEO.
	* Renders <script type="application/ld+json"> blocks for search engines.
	* See: https://developers.google.com/search/docs/appearance/structured-data
	*/

import SITE_URL from "@/lib/site";

function safeJsonStringify(data: unknown) {
	return JSON.stringify(data).replace(
		/[<>&\u2028\u2029]/g,
		(character) =>
			({
				"<": "\\u003c",
				">": "\\u003e",
				"&": "\\u0026",
				"\u2028": "\\u2028",
				"\u2029": "\\u2029",
			})[character] ?? character,
	);
}

export function OrganizationJsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "Organization",
		"@id": `${SITE_URL}/#organization`,
		name: "OMA AI",
		alternateName: "Open Model Access",
		url: SITE_URL,
		logo: `${SITE_URL}/logos/oma-icon-512.png`,
		description:
			"A curated AI model catalog with Chat Completions, prepaid API credits and USDC funding on Base.",
		sameAs: ["https://github.com/NosytLabs"],
		contactPoint: {
			"@type": "ContactPoint",
			email: "support@nosytlabs.com",
			contactType: "customer support",
		},
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: safeJsonStringify(data) }}
		/>
	);
}
/** WebSite entity rendered once in the root layout head. */
export function WebSiteJsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		"@id": `${SITE_URL}/#website`,
		url: SITE_URL,
		name: "OMA AI",
		alternateName: "Open Model Access",
		description:
			"OpenAI-compatible AI inference gateway with USDC payments on Base.",
		publisher: { "@id": `${SITE_URL}/#organization` },
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: safeJsonStringify(data) }}
		/>
	);
}

export function SoftwareApplicationJsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		"@id": `${SITE_URL}/#software-application`,
		name: "OMA AI Gateway",
		applicationCategory: "DeveloperApplication",
		operatingSystem: "Web",
		url: SITE_URL,
		description:
			"OpenAI-compatible API gateway. Multi-model routing, wallet-based auth, and USDC credits on Base.",
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: safeJsonStringify(data) }}
		/>
	);
}

/** BreadcrumbList for deep pages (docs, pricing, models, about, contact). */
export function BreadcrumbListJsonLd({
	items,
}: {
	items: { name: string; url: string }[];
}) {
	const data = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: item.name,
			item: `${SITE_URL}${item.url}`,
		})),
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: safeJsonStringify(data) }}
		/>
	);
}

/** Metered inference is a service; token rates are not flat product offers. */
export function ServiceJsonLd({
	name,
	description,
	url,
	image = `${SITE_URL}/og-image.png`,
}: {
	name: string;
	description: string;
	url: string;
	image?: string;
}) {
	const data = {
		"@context": "https://schema.org",
		"@type": "Service",
		name,
		description,
		url,
		image,
		serviceType: "AI inference API",
		provider: { "@id": `${SITE_URL}/#organization` },
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: safeJsonStringify(data) }}
		/>
	);
}

/** FAQPage for structured Q&A sections. */
export function FAQPageJsonLd({
	questions,
}: {
	questions: { question: string; answer: string }[];
}) {
	const data = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: questions.map((q) => ({
			"@type": "Question",
			name: q.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: q.answer,
			},
		})),
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: safeJsonStringify(data) }}
		/>
	);
}
