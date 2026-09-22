// Auth-gated product surface — render at request time only.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Dashboard — keys, usage & credits",
	description:
		"Manage your API keys, view usage statistics, and deposit credits.",
	alternates: { canonical: "/dashboard" },
	robots: { index: false, follow: false },
	openGraph: {
		title: "Dashboard · OMA",
		description:
			"Manage your API keys, view usage statistics, and deposit credits.",
		images: [
			{
				url: "/og-image.png",
				width: 1280,
				height: 720,
				alt: "OMA — One gateway. Every model.",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Dashboard · OMA",
		description:
			"Manage your API keys, view usage statistics, and deposit credits.",
	},
};

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="bg-void text-text-secondary">
			{children}
		</div>
	);
}
