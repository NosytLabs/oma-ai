import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Motion Design System — OMA",
	description:
		"OMA's motion design language: easing curves, spring physics, magnetic buttons, and reveal animations built on Framer Motion.",
	alternates: { canonical: "/design/motion" },
	openGraph: {
		title: "Motion Design System — OMA",
		description:
			"Easing curves, spring physics, magnetic buttons, and reveal animations.",
		url: "https://oma-ai.com/design/motion",
		siteName: "OMA",
		type: "website",
	},
	robots: { index: true, follow: true },
};

export default function MotionLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
