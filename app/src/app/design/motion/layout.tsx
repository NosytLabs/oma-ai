import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Motion Design System",
	description:
		"OMA's motion design language: easing curves, spring physics, magnetic buttons, and reveal animations built on Framer Motion.",
	alternates: { canonical: "/design/motion" },
	openGraph: {
		title: "Motion Design System — OMA",
		description:
			"Easing curves, spring physics, magnetic buttons, and reveal animations.",
		url: "https://oma-ai.com/design/motion",
		type: "website",
		images: [
			{
				url: "/og-image.webp",
				width: 1280,
				height: 720,
				alt: "OMA — One gateway. Every model.",
			},
		],
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
