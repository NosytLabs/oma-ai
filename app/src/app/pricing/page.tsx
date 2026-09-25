import type { Metadata } from "next";
import PricingPageClient from "./_components/PricingPageClient";
import Link from "next/link";

// No model COUNT appears in this metadata, deliberately, and MODEL_COUNT is no
// longer imported here. Availability is a live API fact: the table below marks
// every unavailable row, so a count baked into a build-time <head> is a claim
// that rots the moment a provider key is added, revoked or expires. Measured
// live: 18 of 20 models were dark while this still advertised "20 curated".
// The body keeps reporting the real number; the metadata describes the page.
const TITLE = "Pricing — frontier, premium and mid-range AI models, USDC on Base";
const DESCRIPTION =
	"Transparent per-token pricing behind one OpenAI-compatible endpoint. Pay in USDC on Base; free signup credits included.";

export const metadata: Metadata = {
	title: TITLE,
	description: DESCRIPTION,
	alternates: { canonical: "/pricing" },
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		// Every other page supplies this; without it, links shared to
		// Slack/X/Discord render with no preview card.
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
				<Link href="/models" className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Compare models</Link>
				<Link href="/getting-started" className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">New to OMA? Get started</Link>
				<Link href="/docs" className="hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Read the API docs</Link>
			</nav>
		</>
	);
}
