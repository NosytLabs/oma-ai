// Auth-gated product surface — render at request time only.
export const dynamic = "force-dynamic";

import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "API Chat playground",
	description:
		"Interactive AI chat playground. Test models, compare responses, stream completions. Pay per token with crypto.",
	alternates: { canonical: "/chat" },
	// Session-gated — keep out of the public index.
	robots: { index: false, follow: false },
};

export default function ChatLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
