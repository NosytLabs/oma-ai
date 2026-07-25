import type { Metadata } from "next";
import { MODEL_COUNT } from "@/lib/models-data";

// models/ page is fully client; opt the whole segment out of static prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "AI Models Catalog — pricing & capabilities",
	description: `Browse ${MODEL_COUNT}+ AI models including Claude, Llama, Qwen, DeepSeek, and more. Compare pricing across Venice AI and multi-provider routes. OpenAI-compatible.`,
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
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA Models" }],
	},
};

export default function ModelsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}