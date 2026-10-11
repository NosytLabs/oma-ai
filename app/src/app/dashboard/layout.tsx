// Auth-gated product surface — render at request time only.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { MotionProvider } from "@/lib/animation/MotionProvider";

export const metadata: Metadata = {
	title: "Dashboard — account, usage & credits",
	description:
		"Manage account settings, API keys, usage statistics and prepaid credits.",
	alternates: { canonical: "/dashboard" },
	robots: { index: false, follow: false },
	openGraph: {
		locale: "en_US",
		title: "Dashboard · OMA",
		description:
			"Manage account settings, API keys, usage statistics and prepaid credits.",
		url: "/dashboard",
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
			"Manage account settings, API keys, usage statistics and prepaid credits.",
	},
};

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="bg-void text-text-secondary">
			<MotionProvider>{children}</MotionProvider>
		</div>
	);
}
