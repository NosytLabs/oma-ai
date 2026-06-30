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
		images: [
			{ url: "/og-image.png", width: 1200, height: 630, alt: "OMA AI Gateway" },
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Crypto Swap | OMA AI",
		description: "Swap crypto across chains with aggregated liquidity.",
		images: [
			{ url: "/og-image.png", width: 1200, height: 630, alt: "OMA AI Gateway" },
		],
	},
};

export default function SwapLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
