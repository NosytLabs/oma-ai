import type { Metadata } from "next";
import PricingPageClient from "./_components/PricingPageClient";
import Link from "next/link";

// Counts, availability and signup offers are live facts, not build-time claims.
const TITLE = "Pricing — AI models, USDC on Base";
const DESCRIPTION =
	"Compare per-token model prices for OMA’s OpenAI-compatible API. Use prepaid credits, pay with USDC on Base, and track usage with no monthly fee.";

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: { canonical: "/pricing" },
	openGraph: {
		locale: "en_US",
		title: TITLE,
		description: DESCRIPTION,
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA pricing" }],
		type: "website",
		url: "/pricing",
	},
	twitter: {
		card: "summary_large_image",
		title: TITLE,
		description: DESCRIPTION,
		images: ["/og-image.png"],
	},
};

export default function PricingPage() {
	return (
		<>
			<PricingPageClient />
			<nav aria-label="Pricing resources" className="container-page flex flex-wrap gap-x-5 gap-y-2 border-t border-border py-5 text-sm text-text-secondary">
				<Link href="/models" className="inline-flex min-h-6 items-center -my-1 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Compare models</Link>
				<Link href="/getting-started" className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">New to OMA? Get started</Link>
				<Link href="/docs" className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Read the API docs</Link>
			</nav>
		</>
	);
}
