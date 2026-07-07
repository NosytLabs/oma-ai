import type { Metadata } from "next";
import { ImageGenerationPanel } from "@/components/chat/ImageGenerationPanel";

export const metadata: Metadata = {
	title: "Image Generation · OMA",
	description:
		"Generate images from text with SDXL, Flux, and Stable Diffusion 3.5, charged per-image in credits.",
	alternates: { canonical: "/image-generation" },
};

export default function ImageGenerationPage() {
	return <ImageGenerationPanel />;
}
