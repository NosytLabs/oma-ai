import type { Metadata } from "next";
import { MODEL_COUNT } from "@/lib/models-data";

export const metadata: Metadata = {
	title: "Pricing",
	description: `Transparent AI API pricing. Pay per token with crypto. No subscriptions, no hidden fees. Access ${MODEL_COUNT} models from $0.06/M tokens.`,
	keywords: [
		"AI pricing",
		"token pricing",
		"crypto payments",
		"OpenAI compatible",
		"pay per token",
	],
	alternates: { canonical: "/pricing" },
	openGraph: {
		title: "AI API Pricing | OMA AI",
		description: `Pay per token, no subscriptions. Access ${MODEL_COUNT} AI models from $0.06/M tokens. Crypto payments supported.`,
	},
	twitter: {
		card: "summary_large_image",
		title: "AI API Pricing | OMA AI",
		description: "Transparent pay-per-token pricing. No subscriptions.",
	},
};

export default function PricingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}