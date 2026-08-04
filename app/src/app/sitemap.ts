import type { MetadataRoute } from "next";
import { MODELS } from "@/lib/models-data";

/**
 * Public marketing / product sitemap only.
 * Auth-gated surfaces (/chat, /deposit, /dashboard, /settings, /admin,
 * /image-generation, /video-generation) are intentionally omitted — they
 * redirect to /login for anonymous users and would create soft-404 SEO noise.
 */
export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = "https://oma-ai.com";
	const now = new Date();

	const entry = (
		path: string,
		priority: number,
		changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
	): MetadataRoute.Sitemap[number] => ({
		url: path === "/" ? baseUrl : `${baseUrl}${path}`,
		lastModified: now,
		changeFrequency,
		priority,
	});

	return [
		entry("/", 1, "weekly"),
		// Marketing / product (public)
		entry("/models", 0.9, "daily"),
		...MODELS.map((model) => entry(`/models/${model.id}`, 0.8, "daily")),
		entry("/pricing", 0.9, "weekly"),
		entry("/docs", 0.85, "weekly"),
		entry("/capabilities", 0.8, "weekly"),
		entry("/getting-started", 0.8, "weekly"),
		entry("/faq", 0.7, "monthly"),
		entry("/glossary", 0.6, "monthly"),
		entry("/compare", 0.75, "weekly"),
		entry("/about", 0.6, "monthly"),
		entry("/observability", 0.5, "monthly"),
		entry("/changelog", 0.5, "monthly"),
		entry("/contact", 0.4, "yearly"),
		// Legal
		entry("/privacy", 0.25, "yearly"),
		entry("/terms", 0.25, "yearly"),
	];
}
