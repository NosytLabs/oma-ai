// Auth-gated product surface — render at request time only.
export const dynamic = "force-dynamic";

import Link from "next/link";
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
				url: "/og-image.webp",
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
		<div className="min-h-[calc(100dvh-3.5rem)] md:min-h-[calc(100dvh-2.75rem)] bg-void text-text-secondary font-mono">
			{children}
			<footer className="mx-auto mt-16 max-w-5xl border-t border-border px-4 py-6 text-[10px] font-mono text-text-muted sm:px-8">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<span className="uppercase tracking-widest text-text-secondary/70">
						OMA · One gateway · Every model
					</span>
					<Link
						href="/settings"
						className="text-text-muted transition-colors hover:text-text"
						aria-label="Open account settings"
					>
						Settings
					</Link>
				</div>
			</footer>
		</div>
	);
}
