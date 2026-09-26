import type { Metadata } from "next";
import { MotionProvider } from "@/lib/animation/MotionProvider";
import { formatPricePerMillion, MODEL_COUNT, MODELS } from "@/lib/models-data";

const MIN_INPUT = Math.min(
	...MODELS.map((m) => m.inputPricePer1M).filter((p) => p > 0),
);

// pricing/ page is fully client; opt the segment out of static prerender.

export const metadata: Metadata = {
	title: "Transparent AI API pricing — pay per use",
	description: `Transparent AI API pricing. Pay per use with USDC (card optional when enabled). No subscriptions, no hidden fees. Access ${MODEL_COUNT} models from ${formatPricePerMillion(MIN_INPUT)}/M tokens.`,
	keywords: [
		"AI pricing",
		"token pricing",
		"crypto payments",
		"OpenAI compatible",
		"pay per use",
	],
	alternates: { canonical: "/pricing" },
	openGraph: {
		title: "Transparent AI API pricing — OMA",
		description: `Pay per use with USDC on Base (card optional). ${MODEL_COUNT} models, no subscriptions, no hidden fees.`,
		url: "/pricing",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA Pricing" }],
	},
};

export default function PricingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <MotionProvider>{children}</MotionProvider>;
}
