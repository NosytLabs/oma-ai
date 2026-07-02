import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Crypto Swap",
	description:
		"Swap crypto across chains with aggregated liquidity and best-rate routing.",
	alternates: { canonical: "/swap" },
	openGraph: {
		title: "Crypto Swap | OMA AI",
		description:
			"Swap crypto across chains with aggregated liquidity and best-rate routing.",
			},
	twitter: {
		card: "summary_large_image",
		title: "Crypto Swap | OMA AI",
		description: "Swap crypto across chains with aggregated liquidity.",
			},
};

export default function SwapLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
