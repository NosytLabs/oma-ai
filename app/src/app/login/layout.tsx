import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Sign in",
	description:
		"Sign in to OMA with a passwordless email magic link or SIWE on Base. No password required.",
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
