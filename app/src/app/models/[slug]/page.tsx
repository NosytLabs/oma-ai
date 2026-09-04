import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DEFAULT_API_URL } from "@/lib/config";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://oma-ai.com";

import { MODELS } from "@/lib/models-data";
import { StaticModelDetail } from "./_components/StaticModelDetail";
import { LiveModelDetail } from "./_components/LiveModelDetail";

type LiveModelDetail = {
	id: string;
	category?: string;
	context_length?: number | null;
	provider?: string;
	pricing?: { prompt?: string; completion?: string | null };
	architecture?: {
		input_modalities: string[];
		output_modalities: string[];
	};
	supported_parameters?: string[];
};

function liveDisplayName(id: string): string {
	return id
		.replace(/^(openai|minimax|together|deepinfra|venice)\//i, "")
		.split(/[-_]/)
		.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
		.filter(Boolean)
		.join(" ");
}

const fetchLiveModel = cache(
	async (slug: string): Promise<LiveModelDetail | null> => {
		const apiBase = DEFAULT_API_URL;
		try {
			const res = await fetch(`${apiBase}/v1/models`, {
				next: { revalidate: 300 },
			});
			if (!res.ok) return null;
			const json = (await res.json()) as { data?: LiveModelDetail[] };
			const match = json.data?.find((m) => m.id === slug);
			return match ?? null;
		} catch {
			return null;
		}
	},
);

function livePricePer1M(
	perToken: string | null | undefined,
): number | undefined {
	if (!perToken) return undefined;
	const n = parseFloat(perToken);
	return Number.isFinite(n) ? n * 1_000_000 : undefined;
}

function formatPrice(per1M: number): string {
	if (per1M < 0.01) return `$${per1M.toFixed(3)}`;
	return `$${per1M.toFixed(2)}`;
}

function formatLivePrice(per1M: number | undefined): string {
	if (typeof per1M !== "number" || !Number.isFinite(per1M)) return "—";
	return formatPrice(per1M);
}

export function generateStaticParams() {
	return MODELS.map((m) => ({ slug: m.id }));
}

// The public catalog is generated from the curated registry. Unknown slugs
// must be real 404s instead of soft-404 pages that pollute search indexing.
export const dynamicParams = false;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const model = MODELS.find((m) => m.id === slug);
	if (model) {
		const title = `${model.name} · ${model.provider}`;
		const description = `${model.description} ${formatPrice(model.inputPricePer1M)}/M input, ${formatPrice(model.outputPricePer1M)}/M output, ${model.contextLength} context.`;
		return {
			title,
			description,
			openGraph: {
				title,
				description,
				url: `${SITE_URL}/models/${model.id}`,
				images: [{ url: "/og-image.webp", width: 1280, height: 720 }],
			},
			twitter: { card: "summary_large_image", title, description },
			alternates: { canonical: `${SITE_URL}/models/${model.id}` },
		};
	}
	const live = await fetchLiveModel(slug);
	if (!live) return { title: "Model not found" };
	const name = liveDisplayName(slug);
	return {
		title: name,
		description: `${name} — served via the OMA gateway. ${formatLivePrice(livePricePer1M(live.pricing?.prompt))}/M input, ${formatLivePrice(livePricePer1M(live.pricing?.completion))}/M output.`,
		alternates: { canonical: `${SITE_URL}/models/${slug}` },
	};
}

export default async function ModelDetailPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const staticModel = MODELS.find((m) => m.id === slug);
	if (staticModel) {
		return <StaticModelDetail model={staticModel} />;
	}

	const live = await fetchLiveModel(slug);
	if (!live) notFound();
	return <LiveModelDetail slug={slug} live={live} />;
}
