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
};

export default function DocsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
