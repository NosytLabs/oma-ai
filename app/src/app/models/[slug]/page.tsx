import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DEFAULT_API_URL } from "@/lib/config";
import SITE_URL from "@/lib/site";

import { MODEL_PAGES, getModelPageRoutes } from "@/lib/models-data";
import { ModelDetail } from "./_components/ModelDetail";
import { isModelAvailable } from "@/lib/model-availability";
import { withLiveModelDetails, type LiveModelDetails } from "@/app/models/_lib/detail-data";
import { BreadcrumbListJsonLd, ServiceJsonLd } from "@/components/json-ld";

const fetchLiveModel = cache(
	async (slug: string): Promise<LiveModelDetails | null> => {
		const apiBase = DEFAULT_API_URL;
		try {
			const res = await fetch(`${apiBase}/v1/models`, {
				next: { revalidate: 300 },
			});
			if (!res.ok) return null;
			const json = (await res.json()) as { data?: LiveModelDetails[] };
			if (!Array.isArray(json.data)) return null;
			const match = json.data?.find((m) => m.id === slug);
			return match ?? null;
		} catch {
			return null;
		}
	},
);

export function generateStaticParams() {
	return MODEL_PAGES.map((m) => ({ slug: m.id }));
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
	const model = MODEL_PAGES.find((m) => m.id === slug);
	if (!model) notFound();
	// Match the stable sitemap policy: catalog pages remain useful reference
	// material during temporary provider outages. Runtime availability must
	// not deindex a page or persist a stale noindex flag after recovery.
	const robots = { index: true, follow: true };
	const title = `${model.name} · ${model.provider}`;
	const description = `${model.description} Compare current token rates, context limits, capabilities and API examples on OMA.`;
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

export default async function ModelDetailPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const staticModel = MODEL_PAGES.find((m) => m.id === slug);
	if (!staticModel) notFound();
	const live = await fetchLiveModel(slug);
	const model = withLiveModelDetails(staticModel, live);
	// A failed lookup is unknown, not an outage. Keep the reference page indexable.
	const available = model.unavailableReason ? false : live ? isModelAvailable(live) : null;
	const routes = await Promise.all(getModelPageRoutes(slug).map(async (route) => {
		const routeLive = route.id === slug ? live : await fetchLiveModel(route.id);
		const routeModel = withLiveModelDetails(route, routeLive);
		return {
			model: routeModel,
			availability: routeModel.unavailableReason ? false : routeLive ? isModelAvailable(routeLive) : null,
			supportedParameters: routeLive?.supported_parameters,
			supportsTools: routeLive?.supports_tools,
			supportsStreaming: routeLive?.supports_streaming,
		};
	}));
	return (
		<>
			<BreadcrumbListJsonLd
				items={[
					{ name: "Home", url: "/" },
					{ name: "Models", url: "/models" },
					{ name: model.name, url: `/models/${model.id}` },
				]}
			/>
			<ServiceJsonLd
				name={model.name}
				description={model.description}
				url={`${SITE_URL}/models/${model.id}`}
				image={
					model.provider === "Venice"
						? `${SITE_URL}/logos/providers/venice.svg`
						: `${SITE_URL}/logos/oma-icon-512.png`
				}
			/>
			<ModelDetail
				model={model}
				routes={routes}
				availability={available}
				supportedParameters={live?.supported_parameters}
				supportsTools={live?.supports_tools}
				supportsStreaming={live?.supports_streaming}
			/>
		</>
	);
}
