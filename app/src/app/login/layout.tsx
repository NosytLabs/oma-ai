// Auth-gated product surface — render at request time only.

import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Sign in to OMA — email or wallet",
	description:
		"Sign in with a passwordless email link or SIWE on Base. Buy AI inference credits by card through Polar or deposit USDC.",
	alternates: { canonical: "/login" },
	robots: { index: false, follow: false },
};

export default function LoginLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
