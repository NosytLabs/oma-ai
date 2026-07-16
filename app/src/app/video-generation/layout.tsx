import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Video generation playground",
	description:
		"Generate short videos from text or image prompts. Charged per second in OMA credits.",
	alternates: { canonical: "/video-generation" },
	robots: { index: false, follow: false },
};

export default function VideoGenerationLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
