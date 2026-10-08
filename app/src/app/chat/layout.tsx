import type { Metadata } from "next";
import { MotionProvider } from "@/lib/animation/MotionProvider";

export const metadata: Metadata = {
	title: "Chat Playground — free OMA-AI models",
	description:
		"Free AI chat on eligible OMA-AI models, with browser-local history and interactive responses. No account required for guests. Sign in for the full catalog.",
	alternates: { canonical: "/chat" },
	// Free public playground — indexable. robots.ts and sitemap.ts both
	// allow /chat to be crawled; keep the metadata aligned so the page
	// is consistently described as public across all surfaces.
	robots: { index: true, follow: true },
	openGraph: {
		locale: "en_US",
		title: "OMA Chat Playground",
		description:
			"Try OMA-AI models free in the chat playground — no account required. Sign in for the full catalog.",
		url: "/chat",
		images: [
			{
				url: "/og-image.png",
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
	return <MotionProvider>{children}</MotionProvider>;
}
