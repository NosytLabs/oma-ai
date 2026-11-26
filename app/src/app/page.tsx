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
	"One OpenAI-compatible API for a curated model catalog. Sign in with your wallet, pay per use in USDC on Base, and keep your card — and your identity — out of it.";

export const metadata: Metadata = {
	title: {
		absolute: "OMA · Open Model Access — Private AI inference, paid in USDC",
	},
	description: DESCRIPTION,
	alternates: { canonical: "/" },
	openGraph: {
		locale: "en_US",
		title: "OMA · Open Model Access — Private AI inference, paid in USDC",
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
