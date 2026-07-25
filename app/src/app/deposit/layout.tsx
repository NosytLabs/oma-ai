// Auth-gated product surface — render at request time only.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Deposit USDC credits",
	description:
		"Deposit funds to your OMA AI account. USDC on Base supported for pay-per-request inference.",
	alternates: { canonical: "/deposit" },
	openGraph: {
		title: "Deposit USDC credits | OMA AI",
		description:
			"Deposit funds to your OMA AI account. USDC on Base supported for pay-per-request inference.",
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA Deposit" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Deposit USDC credits | OMA AI",
		description:
			"Deposit funds to your OMA AI account. USDC on Base supported.",
		images: ["/og-image.webp"],
	},
	// Session-gated — keep out of the public index.
	robots: { index: false, follow: false },
};

export default function DepositLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
