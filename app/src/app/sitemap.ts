import type { MetadataRoute } from "next";
import { MODELS } from "@/lib/models-data";
import { GLOSSARY_SLUGS } from "@/components/glossary-data";
import SITE_URL from "@/lib/site";

/**
 * Public marketing / product sitemap only.
 *
 * Keep the crawl graph stable across temporary provider outages. Model pages
 * are useful catalog/documentation pages even when a provider is briefly not
 * accepting requests, so transient runtime availability must not remove URLs
 * from the sitemap. Permanently retired models should be removed from MODELS
 * (and redirected when an old URL has external value).
 *
 * lastModified is intentionally omitted unless we have a source-owned,
 * semantic modification date. Using the deploy date makes unchanged pages
 * look freshly edited on every release and produces noisy freshness signals.
 */
export default function sitemap(): MetadataRoute.Sitemap {
	const entry = (
		path: string,
		priority: number,
		changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
	): MetadataRoute.Sitemap[number] => ({
		url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
		changeFrequency,
		priority,
	});

	return [
		entry("/", 1, "weekly"),
		entry("/models", 0.9, "daily"),
		...MODELS.map((model) => entry(`/models/${model.id}`, 0.8, "weekly")),
		entry("/chat", 0.85, "weekly"),
		entry("/pricing", 0.9, "weekly"),
		entry("/docs", 0.9, "weekly"),
		entry("/getting-started", 0.85, "weekly"),
		entry("/faq", 0.7, "monthly"),
		entry("/glossary", 0.6, "monthly"),
		...GLOSSARY_SLUGS.map((slug) => entry(`/glossary/${slug}`, 0.5, "monthly")),
		entry("/about", 0.6, "monthly"),
		entry("/contact", 0.4, "yearly"),
		entry("/status", 0.5, "daily"),
		entry("/changelog", 0.5, "weekly"),
		entry("/privacy", 0.25, "yearly"),
		entry("/terms", 0.25, "yearly"),
	];
}
