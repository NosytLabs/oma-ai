// Auth-gated product surface — render at request time only.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Deposit USDC credits",
	description:
		"Deposit credits to your OMA AI account. USDC on Base supported for usage-based inference.",
	alternates: { canonical: "/deposit" },
	openGraph: {
		title: "Deposit USDC credits · OMA",
		description:
			"Deposit credits to your OMA AI account. USDC on Base supported for usage-based inference.",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA Deposit" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Deposit USDC credits · OMA",
		description:
			"Deposit credits to your OMA AI account. USDC on Base supported.",
		images: ["/og-image.png"],
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
