import type { Metadata } from "next";
import { MODEL_COUNT } from "@/lib/models-data";

// pricing/ page is fully client; opt the segment out of static prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Transparent AI API pricing — pay per token",
	description: `Transparent AI API pricing. Pay per token with crypto. No subscriptions, no hidden fees. Access ${MODEL_COUNT}+ models from budget tiers under $0.10/M tokens.`,
	keywords: [
		"AI pricing",
		"token pricing",
		"crypto payments",
		"OpenAI compatible",
		"pay per token",
	],
	alternates: { canonical: "/pricing" },
	openGraph: {
		title: "Transparent AI API pricing — OMA",
		description: `Pay per token with USDC. ${MODEL_COUNT}+ models, no subscriptions, no hidden fees.`,
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA Pricing" }],
	},
};

export default function PricingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}