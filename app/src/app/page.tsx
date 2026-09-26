import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthNotice } from "@/components/AuthNotice";
import { HomeView } from "./_components/home";

// NOTE: this description deliberately carries no model count. It used to
// interpolate MODEL_COUNT (a static fallback of 20) while the catalog
// reported 2 live models — an inaccurate claim in the snippet Google shows
// under the title. Availability changes hourly; a build-time constant in
// static metadata cannot track it, so the number is simply left out.
const DESCRIPTION =
	"One gateway. Every model. No lock-in. OpenAI-compatible API, wallet-based auth, USDC on Base, optional card checkout, and x402 settlement.";

export const metadata: Metadata = {
	title: {
		absolute: "OMA · Open Model Access — AI inference, USDC on Base",
	},
	description: DESCRIPTION,
	alternates: { canonical: "/" },
	openGraph: {
		title: "OMA · Open Model Access — AI inference, USDC on Base",
		description: DESCRIPTION,
		url: "/",
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
