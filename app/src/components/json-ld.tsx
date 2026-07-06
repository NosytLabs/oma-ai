/**
 * JSON-LD structured data for SEO.
 * Renders <script type="application/ld+json"> blocks for search engines.
 * See: https://developers.google.com/search/docs/appearance/structured-data
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://oma-ai.com";

export function OrganizationJsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: "OMA AI",
		alternateName: "Open Model Access",
		url: BASE_URL,
		logo: `${BASE_URL}/favicon.svg`,
		description:
			"Run any model, pay per request with USDC. AI models behind one OpenAI-compatible API. x402-native, no subscriptions.",
		sameAs: [
			"https://twitter.com/oma_ai",
			"https://github.com/oma-ai",
		],
		contactPoint: {
			"@type": "ContactPoint",
			email: "support@oma-ai.com",
			contactType: "customer support",
		},
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
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
			"OpenAI-compatible API gateway to 100+ AI models. Pay per request with USDC on Base. No subscriptions.",
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
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
		/>
	);
}

export function FAQPageJsonLd(questions: { question: string; answer: string }[]) {
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
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
		/>
	);
}
