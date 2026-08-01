// Auth-gated product surface — auth is enforced client-side in the chat
// shell (useAuth), so this page prerenders safely; metadata stays in <head>.

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
