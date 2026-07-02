import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthNotice } from "@/components/AuthNotice";
import { MODEL_COUNT } from "@/lib/models-data";
import { HomeView } from "./_components/home";

export const metadata: Metadata = {
	// absolute: bypasses layout.tsx template ("%s | OMA-AI") so the browser
	// tab shows exactly this string instead of "Title | OMA-AI" doubled.
	title: { absolute: "Open Model Access · One API for every model" },
	description: `Run any model, pay per request with USDC. ${MODEL_COUNT}+ AI models behind one OpenAI-compatible API. x402-native, no subscriptions, no monthly bills.`,
	openGraph: {
		title: "Open Model Access · One API for every model",
		description: `Run any model, pay per request with USDC. ${MODEL_COUNT}+ AI models behind one OpenAI-compatible API. x402-native, no subscriptions.`,
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
