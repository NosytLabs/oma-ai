import type { Metadata } from "next";
import { MODEL_COUNT } from "@/lib/models-data";
import PricingPageClient from "./_components/PricingPageClient";

export const metadata: Metadata = {
	title: `Pricing — ${MODEL_COUNT} curated AI models, USDC on Base`,
	description: `Transparent, per-token pricing for ${MODEL_COUNT} curated AI models behind one OpenAI-compatible endpoint. Pay in USDC on Base; free signup credits included.`,
	alternates: { canonical: "/pricing" },
	openGraph: {
		title: `Pricing — ${MODEL_COUNT} curated AI models, USDC on Base`,
		description:
			"Transparent per-token pricing for frontier, premium, and mid-range AI models. One endpoint, pay in USDC on Base.",
		type: "website",
		url: "/pricing",
	},
};

export default function PricingPage() {
	return <PricingPageClient />;
}
