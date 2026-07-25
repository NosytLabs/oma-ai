// Auth-gated product surface — render at request time only.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Sign in to OMA — wallet or account number",
	description:
		"Sign in with SIWE on Base or a private 16-digit account number. No email, no password — pay for AI inference in USDC.",
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
