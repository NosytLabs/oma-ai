import type { Metadata } from "next";
import { MODEL_COUNT } from "@/lib/models-data";
import { DocsContent } from "./DocsContent";
import Link from "next/link";

export const metadata: Metadata = {
	title: "API Documentation — OpenAI-compatible AI inference",
	description: `OpenAI-compatible AI inference reference. ${MODEL_COUNT} models, wallet auth, x402 settlement flows, and provider routing — all behind one endpoint.`,
	alternates: { canonical: "/docs" },
	openGraph: {
		locale: "en_US",
		title: "API Documentation — OMA AI Gateway",
		description: `OpenAI-compatible AI inference reference. ${MODEL_COUNT} models behind one endpoint. Wallet auth and x402 settlement on Base.`,
		url: "/docs",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA API Documentation" }],
		type: "article",
	},
	twitter: {
		card: "summary_large_image",
		title: "API Documentation — OMA AI Gateway",
		description: `OpenAI-compatible AI inference reference. ${MODEL_COUNT} models behind one endpoint.`,
		images: ["/og-image.png"],
	},
	robots: { index: true, follow: true },
};

export default function DocsPage() {
	return (
		<>
			<DocsContent />
			<nav aria-label="Documentation resources" className="border-t border-border bg-surface px-4 py-5 text-sm text-text-secondary sm:px-6 lg:pl-80">
				<span className="mx-auto flex max-w-5xl flex-wrap gap-x-5 gap-y-2">
					<Link href="/api/v1/openapi.json" className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" rel="alternate">OpenAPI 2.1 spec</Link>
					<Link href="/getting-started" className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Getting started</Link>
					<Link href="/pricing" className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Pricing</Link>
					<Link href="/contact" className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Contact support</Link>
				</span>
			</nav>
		</>
	);
}
