import type { Metadata } from "next";
import { MotionProvider } from "@/lib/animation/MotionProvider";

// models/ page is fully client; opt the whole segment out of static prerender.

// No model COUNT appears in this metadata, deliberately. Availability is a live
// property -- it changes when an upstream key is added, revoked, or
// rate-limited -- and this metadata is baked at build time and not rebuilt on
// that event. The previous copy interpolated the static MODEL_COUNT (20), so
// every search result and social card pitched a 20-model catalog while the page
// itself rendered the number actually accepting requests. A count that cannot
// stay true should not be asserted; the page body reports the live figure.
const DESCRIPTION =
	"Catalog of GLM, Qwen, DeepSeek and more with transparent per-token pricing, provider routing and OpenAI-compatible endpoints.";

export const metadata: Metadata = {
	title: "AI Models Catalog — pricing & capabilities",
	description: DESCRIPTION,
	keywords: [
		"AI models",
		"OpenAI compatible API",
		"GLM",
		"Qwen",
		"DeepSeek",
		"Venice AI",
		"LLM pricing",
	],
	alternates: { canonical: "/models" },
	openGraph: {
		title: "AI Models Catalog — OMA",
		description: DESCRIPTION,
		images: [
			{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA Models" },
		],
	},
};

export default function ModelsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <MotionProvider>{children}</MotionProvider>;
}