import type { Metadata } from "next";

// docs/ uses client-side search/nav; opt the whole segment out of static prerender.

export const metadata: Metadata = {
	title: "API Documentation — OpenAI-compatible gateway",
	description:
		"Complete API reference for the OMA AI gateway: authentication (SIWE / API keys), chat completions, streaming, rate limits, and x402 settlement.",
	keywords: [
		"OMA API",
		"API documentation",
		"AI gateway",
		"OpenAI compatible",
		"x402",
		"chat completions",
	],
	alternates: { canonical: "/docs" },
	openGraph: {
		title: "API Documentation — OMA",
		description:
			"OpenAI-compatible API reference: auth, chat, streaming, x402 payments, rate limits.",
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA Docs" }],
	},
};

export default function DocsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
