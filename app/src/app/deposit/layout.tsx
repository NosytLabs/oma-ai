import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Deposit Credits",
	description:
		"Deposit funds to your OMA AI account. USDC on Base supported.",
	alternates: { canonical: "/deposit" },
	openGraph: {
		title: "Deposit Credits | OMA AI",
		description:
			"Deposit funds to your OMA AI account. USDC on Base supported.",
			},
	twitter: {
		card: "summary_large_image",
		title: "Deposit Credits | OMA AI",
		description:
			"Deposit funds to your OMA AI account. USDC on Base supported.",
			},
	robots: {
		index: true,
		follow: true,
	},
};

export default function DepositLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
