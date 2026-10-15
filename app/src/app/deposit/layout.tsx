// Auth-gated product surface — render at request time only.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { MotionProvider } from "@/lib/animation/MotionProvider";

export const metadata: Metadata = {
	title: "Add credits",
	description:
		"Add prepaid OMA API credits and choose from the available payment methods.",
	alternates: { canonical: "/deposit" },
	openGraph: {
		locale: "en_US",
		title: "Add credits · OMA",
		description:
			"Add prepaid OMA API credits and choose from the available payment methods.",
		url: "/deposit",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA Deposit" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Add credits · OMA",
		description:
			"Add prepaid OMA API credits and choose from the available payment methods.",
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
	return <MotionProvider>{children}</MotionProvider>;
}
