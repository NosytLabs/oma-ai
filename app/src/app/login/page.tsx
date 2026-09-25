import type { Metadata } from "next";
import LoginPageClient from "./_components/LoginPageClient";

export const metadata: Metadata = {
	title: { absolute: "Sign in — OMA" },
	description:
		"Sign in to OMA with a magic link or your wallet. No password to lose — passwordless, crypto-native access to curated AI models.",
	alternates: { canonical: "/login" },
	robots: {
		index: false,
		follow: false,
	},
};

export default function LoginPage() {
	return <LoginPageClient />;
}
