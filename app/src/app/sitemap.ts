import type { MetadataRoute } from "next";
import { MODELS } from "@/lib/models-data";

/**
 * Public marketing / product sitemap only.
 * Auth-gated surfaces (/chat, /deposit, /dashboard, /settings, /admin)
 * are intentionally omitted — soft-404 SEO noise for anonymous crawlers.
 * Legacy /image-generation and /video-generation permanently redirect to /chat.
 *
 * lastModified is day-bucketed (UTC) so crawlers see stable timestamps within
 * a deploy day rather than a new Date() on every request.
 */
export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = "https://oma-ai.com";
	const now = new Date();
	const dayStamp = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);

	const entry = (
		path: string,
		priority: number,
		changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
	): MetadataRoute.Sitemap[number] => ({
		url: path === "/" ? baseUrl : `${baseUrl}${path}`,
		lastModified: dayStamp,
		changeFrequency,
		priority,
	});

	return [
		entry("/", 1, "weekly"),
		// Marketing / product (public)
		entry("/models", 0.9, "daily"),
		...MODELS.map((model) => entry(`/models/${model.id}`, 0.8, "weekly")),
		entry("/pricing", 0.9, "weekly"),
		entry("/docs", 0.9, "weekly"),
		entry("/capabilities", 0.8, "weekly"),
		entry("/getting-started", 0.85, "weekly"),
		entry("/faq", 0.7, "monthly"),
		entry("/glossary", 0.6, "monthly"),
		entry("/compare", 0.75, "weekly"),
		entry("/about", 0.6, "monthly"),
		entry("/observability", 0.5, "monthly"),
		entry("/changelog", 0.55, "weekly"),
		entry("/contact", 0.4, "yearly"),
		// Legal
		entry("/privacy", 0.25, "yearly"),
		entry("/terms", 0.25, "yearly"),
	];
}
