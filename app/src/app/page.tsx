import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthNotice } from "@/components/AuthNotice";
import { MODEL_COUNT } from "@/lib/models-data";
import { HomeView } from "./_components/home";

export const metadata: Metadata = {
	title: {
		absolute: "OMA · Open Model Access — AI inference, paid by card or USDC",
	},
	description: `One gateway. Every model. No lock-in. OpenAI-compatible API with ${MODEL_COUNT}+ models, wallet-based auth, card payments via Polar, and USDC pay-per-request on Base.`,
	alternates: { canonical: "/" },
	openGraph: {
		title: "OMA · Open Model Access — AI inference, paid by card or USDC",
		description: `One gateway. Every model. No lock-in. OpenAI-compatible API with ${MODEL_COUNT}+ models, wallet-based auth, card payments via Polar, and USDC pay-per-request on Base.`,
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA" }],
	},
	robots: { index: true, follow: true },
};

export default function HomePage() {
	return (
		<>
			<Suspense fallback={null}>
				<AuthNotice />
			</Suspense>
			<HomeView />
		</>
	);
}
