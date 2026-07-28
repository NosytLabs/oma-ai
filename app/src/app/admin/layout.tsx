import type { Metadata } from "next";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Admin console",
	description:
		"OMA admin console — users, usage, revenue, fees, and rate limits.",
	robots: { index: false, follow: false },
};

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-[calc(100dvh-2.75rem)] bg-void text-text">
			{/* useSearchParams in admin page requires a Suspense boundary (Next 15). */}
			<Suspense
				fallback={
					<div className="flex min-h-[40vh] items-center justify-center text-sm text-text-muted font-mono">
						Loading admin…
					</div>
				}
			>
				{children}
			</Suspense>
		</div>
	);
}
