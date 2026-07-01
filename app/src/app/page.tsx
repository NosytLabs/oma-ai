import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthNotice } from "@/components/AuthNotice";
import { MODEL_COUNT } from "@/lib/models-data";
import { HomeView } from "./_components/home";

export const metadata: Metadata = {
	title: "OMA · One key for every model",
	description:
		"Anonymous AI inference. No KYC, no email, no subscriptions. Pay per request in USDC. Mullvad-style account numbers and private inference through Venice. 17+ AI models, one OpenAI-compatible API.",
	openGraph: {
		title: "OMA · One key for every model",
		description:
			"Anonymous AI inference. No KYC, no email, no subscriptions. Mullvad-style account numbers and private inference through Venice. Pay per request in USDC.",
		images: [{ url: "/og-image.png", width: 1200, height: 630 }],
	},
};

export default function HomePage() {
	return (
		<>
			<Suspense fallback={null}>
				<AuthNotice />
			</Suspense>
			<HomeView modelCount={MODEL_COUNT} />
		</>
	);
}
