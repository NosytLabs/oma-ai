import type { Metadata } from "next";
import { MODEL_COUNT } from "@/lib/models-data";

// models/ page is fully client; opt the whole segment out of static prerender.

export const metadata: Metadata = {
	title: "AI Models Catalog — pricing & capabilities",
	description: `Browse ${MODEL_COUNT} live AI models — GLM 5.2, Qwen 3.7 Plus, DeepSeek V4 Flash — with transparent per-token pricing across Venice and OMA-AI providers. OpenAI-compatible.`,
	keywords: [
		"AI models",
		"Claude",
		"Llama",
		"Qwen",
		"DeepSeek",
		"AI API",
		"LLM pricing",
	],
	alternates: { canonical: "/models" },
	openGraph: {
		title: "AI Models Catalog — OMA",
		description: `Browse ${MODEL_COUNT}+ models with transparent per-token pricing. One API key, multi-provider routing.`,
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA Models" }],
	},
};

export default function ModelsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}