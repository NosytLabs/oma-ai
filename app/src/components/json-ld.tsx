/**
	* JSON-LD structured data for SEO.
	* Renders <script type="application/ld+json"> blocks for search engines.
	* See: https://developers.google.com/search/docs/appearance/structured-data
	*/

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://oma-ai.com";

function safeJsonStringify(data: unknown) {
	return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function OrganizationJsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: "OMA AI",
		alternateName: "Open Model Access",
		url: BASE_URL,
		logo: `${BASE_URL}/logos/oma-icon-512.png`,
		description:
			"One gateway. Every model. No lock-in. OpenAI-compatible AI inference paid per request in USDC on Base.",
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

export function SoftwareApplicationJsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: "OMA AI Gateway",
		applicationCategory: "DeveloperApplication",
		operatingSystem: "Web",
		url: BASE_URL,
		description:
			"OpenAI-compatible API gateway. Multi-model routing, wallet-based auth, and USDC credits on Base.",
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
			description: "Pay-per-request pricing. No monthly fees.",
		},
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
			item: `${BASE_URL}${item.url}`,
		})),
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: safeJsonStringify(data) }}
		/>
	);
}

/** Product + AggregateOffer for a pricing tier. */
export function ProductJsonLd({
	name,
	description,
	price,
	priceCurrency = "USD",
}: {
	name: string;
	description: string;
	price: string;
	priceCurrency?: string;
}) {
	const data = {
		"@context": "https://schema.org",
		"@type": "Product",
		name,
		description,
		offers: {
			"@type": "Offer",
			price,
			priceCurrency,
			availability: "https://schema.org/InStock",
		},
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


