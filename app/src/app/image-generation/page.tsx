import type { Metadata } from "next";
import { ImageGenerationPanel } from "@/components/chat/ImageGenerationPanel";

// Opt out of static prerender — full client component with effects/state.
export const dynamic = "force-dynamic";

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
