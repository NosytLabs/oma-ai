import type { Metadata } from "next";
import { MODEL_COUNT } from "@/lib/models-data";

export const metadata: Metadata = {
	title: "Models",
	description: `Browse ${MODEL_COUNT} AI models including Claude, Llama, Qwen, DeepSeek, and more. Compare pricing across Venice AI, AntSeed, and other providers.`,
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
};

export default function ModelsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}