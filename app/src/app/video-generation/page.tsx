import type { Metadata } from "next";
import { VideoGenerationPanel } from "@/components/chat/VideoGenerationPanel";

export const metadata: Metadata = {
	title: "Video generation playground",
	description:
		"Generate short videos from text or image prompts. Charged per second in OMA credits.",
	alternates: { canonical: "/video-generation" },
	robots: { index: false, follow: false },
};

export default function VideoGenerationPage() {
	return <VideoGenerationPanel />;
}
