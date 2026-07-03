import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "API Chat",
	description:
		"Interactive AI chat playground. Test models, compare responses, stream completions. Pay per token with crypto.",
	alternates: { canonical: "/chat" },
};

export default function ChatLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
