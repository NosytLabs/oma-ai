import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "API Chat",
	description:
		"Interactive AI chat playground. Test models, compare responses, stream completions. Pay per token with crypto.",
	alternates: { canonical: "/chat" },
	openGraph: {
		title: "API Chat | OMA AI",
		description:
			"Interactive AI chat playground. Test models, compare responses, stream completions.",
			},
	twitter: {
		card: "summary_large_image",
		title: "API Chat | OMA AI",
		description:
			"Interactive AI chat playground. Test models, compare responses.",
			},
};

export default function ChatLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
