import type { Metadata } from "next";
import { ImageGenerationPanel } from "@/components/chat/ImageGenerationPanel";

export const metadata: Metadata = {
	title: "Image generation playground",
	description:
		"Generate images from text with FLUX and SDXL models. Charged per image in OMA credits.",
	alternates: { canonical: "/image-generation" },
	robots: { index: false, follow: false },
};

export default function ImageGenerationPage() {
	return <ImageGenerationPanel />;
}
