import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "API Documentation",
	description:
		"Complete API reference for OMA AI gateway. Authentication, chat completions, image generation, x402 payments, and more.",
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
		title: "API Documentation | OMA AI",
		description:
			"Complete API reference for OMA — OpenAI-compatible endpoints with crypto-native billing.",
		images: [
			{
				url: "/opengraph-image",
				width: 1200,
				height: 630,
				alt: "OMA AI Gateway",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "API Documentation | OMA AI",
		description: "Complete API reference for OMA AI gateway.",
	},
};

export default function DocsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
