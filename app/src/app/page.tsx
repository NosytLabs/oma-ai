import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthNotice } from "@/components/AuthNotice";
import { MODEL_COUNT } from "@/lib/models-data";
import { HomeView } from "./_components/home";

// Homepage composes many client components (AuthNotice + HomeView);
// opt out of static prerender so Next 15 doesn't crash on missing React hooks.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: {
		absolute: "OMA · Open Model Access — AI inference paid in USDC",
	},
	description: `One gateway. Every model. No lock-in. OpenAI-compatible API with ${MODEL_COUNT}+ models, wallet-based auth, and USDC pay-per-request on Base.`,
	alternates: { canonical: "/" },
	openGraph: {
		title: "OMA · Open Model Access — AI inference paid in USDC",
		description: `One gateway. Every model. No lock-in. OpenAI-compatible API with ${MODEL_COUNT}+ models, wallet-based auth, and USDC pay-per-request on Base.`,
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
