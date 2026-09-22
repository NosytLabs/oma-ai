import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthNotice } from "@/components/AuthNotice";
import { MODEL_COUNT } from "@/lib/models-data";
import { HomeView } from "./_components/home";

export const metadata: Metadata = {
	title: {
		absolute: "OMA · Open Model Access — AI inference, USDC on Base",
	},
	description: `One gateway. Every model. No lock-in. OpenAI-compatible API with ${MODEL_COUNT} models, wallet-based auth, USDC on Base, optional card checkout, and x402 settlement.`,
	alternates: { canonical: "/" },
	openGraph: {
		title: "OMA · Open Model Access — AI inference, USDC on Base",
		description: `One gateway. Every model. No lock-in. OpenAI-compatible API with ${MODEL_COUNT} models, wallet-based auth, USDC on Base, optional card checkout, and x402 settlement.`,
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA" }],
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
