import type { Metadata } from "next";
import { VideoGenerationPanel } from "@/components/chat/VideoGenerationPanel";

export const metadata: Metadata = {
	title: "Video Generation · OMA",
	description:
		"Generate short videos from text or image prompts, including image-to-video, charged per-second in credits.",
	alternates: { canonical: "/video-generation" },
};

export default function VideoGenerationPage() {
	return <VideoGenerationPanel />;
}
