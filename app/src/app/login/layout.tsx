// Auth-gated product surface — render at request time only.

import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Sign in",
	description:
		"Sign in with a passwordless email link or SIWE on Base. Buy AI inference credits by card through  (1 credit = $0.01) or deposit USDC.",
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
