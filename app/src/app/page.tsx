import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthNotice } from "@/components/AuthNotice";
import { MODEL_COUNT } from "@/lib/models-data";
import { HomeView } from "./_components/home";

export const metadata: Metadata = {
	title: {
		absolute: "OMA · Open Model Access — AI inference paid in USDC",
	},
	description: `One gateway. Every model. No lock-in. OpenAI-compatible API with ${MODEL_COUNT}+ models, wallet-based auth, and USDC pay-per-request on Base.`,
	openGraph: {
		title: "OMA · Open Model Access — AI inference paid in USDC",
		description: `One gateway. Every model. No lock-in. OpenAI-compatible API with ${MODEL_COUNT}+ models, wallet-based auth, and USDC pay-per-request on Base.`,
	},
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
