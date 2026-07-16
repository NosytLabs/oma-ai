import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Image generation playground",
	description:
		"Generate images from text with FLUX and SDXL models. Charged per image in OMA credits.",
	alternates: { canonical: "/image-generation" },
	robots: { index: false, follow: false },
};

export default function ImageGenerationLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
