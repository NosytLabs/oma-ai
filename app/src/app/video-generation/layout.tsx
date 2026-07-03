import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Video Generation API",
	description:
		"Generate videos with AI using the OMA API. Support for Seedance, Kling, and more. Pay with crypto.",
	keywords: [
		"AI video generation",
		"text to video",
		"AI video",
		"Seedance",
		"Kling",
		"AI API",
	],
	alternates: { canonical: "/video-generation" },
};

export default function VideoGenerationLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
