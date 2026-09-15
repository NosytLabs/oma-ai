import type { Metadata } from "next";
import { MODEL_COUNT } from "@/lib/models-data";
import { DocsContent } from "./DocsContent";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://oma-ai.com";

export const metadata: Metadata = {
	title: "API Documentation",
	description: `OpenAI-compatible AI inference reference. ${MODEL_COUNT} models, wallet auth, x402 settlement flows, and provider routing — all behind one endpoint.`,
	alternates: { canonical: `${SITE_URL}/docs` },
	openGraph: {
		title: "API Documentation — OMA AI Gateway",
		description: `OpenAI-compatible AI inference reference. ${MODEL_COUNT} models behind one endpoint. Wallet auth and x402 settlement on Base.`,
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA API Documentation" }],
		type: "article",
	},
	twitter: {
		card: "summary_large_image",
		title: "API Documentation — OMA AI Gateway",
		description: `OpenAI-compatible AI inference reference. ${MODEL_COUNT} models behind one endpoint.`,
	},
	robots: { index: true, follow: true },
};

export default function DocsPage() {
	return <DocsContent />;
}
