import type { MetadataRoute } from "next";
import { MODELS } from "@/lib/models-data";

/**
 * Public marketing / product sitemap only.
 * Auth-gated surfaces (/chat is indexable since it's the free playground —
 * see robots.ts and the chat layout metadata. /deposit, /dashboard,
 * /settings, /admin) are intentionally omitted — soft-404 SEO noise for
 * anonymous crawlers.
 * Legacy /image-generation and /video-generation permanently redirect to /chat
 * via next.config.ts redirects().
 *
 * lastModified is day-bucketed (UTC) so crawlers see stable timestamps within
 * a deploy day rather than a new Date() on every request.
 *
 * baseUrl resolves from env so staging / preview builds advertise the right
 * host instead of leaking production URLs.
 */
export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl =
		process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
		"https://oma-ai.com";
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
		// Free playground (no auth required for OMA-AI models) — crawlable demo.
		entry("/chat", 0.85, "weekly"),
		entry("/pricing", 0.9, "weekly"),
		entry("/docs", 0.9, "weekly"),
		entry("/getting-started", 0.85, "weekly"),
		entry("/faq", 0.7, "monthly"),
		entry("/glossary", 0.6, "monthly"),
		entry("/about", 0.6, "monthly"),
		entry("/contact", 0.4, "yearly"),
		// Legal
		entry("/privacy", 0.25, "yearly"),
		entry("/terms", 0.25, "yearly"),
	];
}
