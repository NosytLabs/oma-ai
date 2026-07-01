import type { Metadata } from "next";
import { HomeView } from "@/app/_components/home";
import { MODEL_COUNT } from "@/lib/models-data";

export const metadata: Metadata = {
	title: "OMA-AI — AI Compute for Builders",
	description:
		"Run any model, pay per request with USDC. x402-native AI inference gateway. No subscriptions, no monthly bills, no email.",
	openGraph: {
		title: "OMA-AI — AI Compute for Builders",
		description:
			"Run any model, pay per request with USDC. x402-native AI inference. One OpenAI-compatible API, every model.",
		images: [{ url: "/og-image.png", width: 1200, height: 630 }],
	},
};

export default function HomePage() {
	return <HomeView modelCount={MODEL_COUNT} />;
}