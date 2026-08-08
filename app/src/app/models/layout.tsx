import type { Metadata } from "next";
import { MODEL_COUNT } from "@/lib/models-data";

// models/ page is fully client; opt the whole segment out of static prerender.

export const metadata: Metadata = {
	title: "AI Models Catalog — pricing & capabilities",
	description: `Browse ${MODEL_COUNT} curated AI models — GLM 5.2, Qwen 3.7 Plus, DeepSeek V4 Flash, and more — with transparent per-token pricing via Venice and OMA-AI. OpenAI-compatible.`,
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
		description: `Browse ${MODEL_COUNT}+ models with transparent per-token pricing. One API key, multi-provider routing.`,
		images: [
			{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA Models" },
		],
	},
};

export default function ModelsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
