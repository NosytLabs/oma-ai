import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Chat Playground — free OMA-AI models",
	description:
		"Free AI chat playground on OMA-AI budget models. No account required for guests. Sign in for the full catalog and saved conversations.",
	alternates: { canonical: "/chat" },
	// Free public playground — indexable. robots.ts and sitemap.ts both
	// allow /chat to be crawled; keep the metadata aligned so the page
	// is consistently described as public across all surfaces.
	robots: { index: true, follow: true },
	openGraph: {
		title: "OMA Chat Playground",
		description:
			"Try OMA-AI models free in the chat playground — no account required. Sign in for the full catalog.",
		images: [
			{
				url: "/og-image.webp",
				width: 1280,
				height: 720,
				alt: "OMA Chat Playground",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "OMA Chat Playground",
		description:
			"Try OMA-AI models free in the chat playground — no account required. Sign in for the full catalog.",
	},
};

export default function ChatLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
