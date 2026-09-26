import type { Metadata } from "next";
import { formatPrice } from "@/lib/model-utils";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DEFAULT_API_URL } from "@/lib/config";
import SITE_URL from "@/lib/site";

import { MODELS } from "@/lib/models-data";
import { StaticModelDetail } from "./_components/StaticModelDetail";
import { LiveModelDetail } from "./_components/LiveModelDetail";
import { isModelAvailable } from "@/lib/model-availability";
import { liveDisplayName, livePricePer1M } from "@/app/models/_lib/format";
import { BreadcrumbListJsonLd } from "@/components/json-ld";

type LiveModelDetail = {
	id: string;
	available?: boolean;
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

function formatLivePrice(per1M: number | undefined): string {
	if (typeof per1M !== "number" || !Number.isFinite(per1M)) return "—";
	return formatPrice(per1M);
}

function ModelJsonLd({
	name,
	description,
	price,
	url,
	available,
}: {
	name: string;
	description: string;
	price: number;
	url: string;
	available: boolean | null;
}) {
	const data = {
		"@context": "https://schema.org",
		"@type": "Product",
		name,
		description,
		url,
		offers: {
			"@type": "Offer",
			price: price.toString(),
			priceCurrency: "USD",
			description: "Input price per 1 million tokens",
			...(available === true ? { availability: "https://schema.org/InStock" } : {}),
		},
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(data).replace(
					/[<>&\u2028\u2029]/g,
					(character) =>
						({
							"<": "\\u003c",
							">": "\\u003e",
							"&": "\\u0026",
							"\u2028": "\\u2028",
							"\u2029": "\\u2029",
						})[character] ?? character,
				),
			}}
		/>
	);
}

/**
 * Whether a catalog entry is currently accepting requests.
 *
 * `null` means the catalog could not be read, which is NOT the same as
 * "unavailable" — an API blip must not suddenly deindex the whole catalog.
 * Callers therefore only act on an explicit `false`.
 */
const fetchModelAvailability = cache(
	async (slug: string): Promise<boolean | null> => {
		const apiBase = DEFAULT_API_URL;
		try {
			const res = await fetch(`${apiBase}/v1/models`, {
				next: { revalidate: 300 },
			});
			if (!res.ok) return null;
			const json = (await res.json()) as { data?: { id?: string; available?: boolean }[] };
			const match = json.data?.find((m) => m.id === slug);
			if (!match) return null;
			return isModelAvailable(match);
		} catch {
			return null;
		}
	},
);

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
	// A model whose upstream credential is missing still renders (the page is
	// useful and the provider may return), but it must not be INDEXED: a
	// crawler that ranks it sends the visitor to a model that errors. The
	// sitemap already omits these; this closes the discovery paths that do
	// not go through the sitemap — internal links, old indexed URLs, referrers.
	const available = await fetchModelAvailability(slug);
	const robots =
		available === false
			? { index: false, follow: true }
			: { index: true, follow: true };
	if (model) {
		const title = `${model.name} · ${model.provider}`;
		const description = `${model.description} ${formatPrice(model.inputPricePer1M)}/M input, ${formatPrice(model.outputPricePer1M)}/M output, ${model.contextLength} context.`;
		return {
			title,
			description,
			robots,
			openGraph: {
				locale: "en_US",
				title,
				description,
				url: `${SITE_URL}/models/${model.id}`,
				images: [{ url: "/og-image.png", width: 1280, height: 720 }],
			},
			twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
			alternates: { canonical: `${SITE_URL}/models/${model.id}` },
		};
	}
	const live = await fetchLiveModel(slug);
	if (!live) return { title: "Model not found" };
	const name = liveDisplayName(slug);
	return {
		title: name,
		description: `${name} — served via the OMA gateway. ${formatLivePrice(livePricePer1M(live.pricing?.prompt))}/M input, ${formatLivePrice(livePricePer1M(live.pricing?.completion))}/M output.`,
		robots,
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
		const available = await fetchModelAvailability(slug);
		return (
			<>
				<BreadcrumbListJsonLd
					items={[
						{ name: "Home", url: "/" },
						{ name: "Models", url: "/models" },
						{ name: staticModel.name, url: `/models/${staticModel.id}` },
					]}
				/>
				<ModelJsonLd
					name={staticModel.name}
					description={staticModel.description}
					price={staticModel.inputPricePer1M}
					url={`${SITE_URL}/models/${staticModel.id}`}
					available={available}
				/>
				<StaticModelDetail model={staticModel} />
			</>
		);
	}

	const live = await fetchLiveModel(slug);
	if (!live) notFound();
	const available = await fetchModelAvailability(slug);
	const inputPrice = livePricePer1M(live.pricing?.prompt);
	return (
		<>
			<BreadcrumbListJsonLd
				items={[
					{ name: "Home", url: "/" },
					{ name: "Models", url: "/models" },
					{ name: liveDisplayName(slug), url: `/models/${slug}` },
				]}
			/>
			{inputPrice !== undefined && (
				<ModelJsonLd
					name={liveDisplayName(slug)}
					description={`${liveDisplayName(slug)} — served via the OMA gateway.`}
					price={inputPrice}
					url={`${SITE_URL}/models/${slug}`}
					available={available}
				/>
			)}
			<LiveModelDetail slug={slug} live={live} />
		</>
	);
}
