import type { MetadataRoute } from "next";
import { MODELS } from "@/lib/models-data";

/**
 * Ids of models currently accepting requests, or null when the catalog
 * could not be read.
 *
 * Resolved relative to this app rather than a hardcoded host so preview and
 * staging builds query their own API. Same-origin relative fetch also avoids
 * needing an absolute URL at build time.
 */
async function fetchAvailableModelIds(): Promise<Set<string> | null> {
	const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
	const url = base ? `${base}/v1/models` : "/api/v1/models";
	try {
		const res = await fetch(url, { next: { revalidate: 300 } });
		if (!res.ok) return null;
		const json = (await res.json()) as {
			data?: { id?: string; available?: boolean }[];
		};
		if (!Array.isArray(json.data)) return null;
		return new Set(
			json.data.filter((m) => m.available !== false && m.id).map((m) => m.id as string),
		);
	} catch {
		return null;
	}
}

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
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const baseUrl =
		process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
		// The apex 308-redirects to www, so www is the canonical host.
		"https://www.oma-ai.com";
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

	const availableModelIds = await fetchAvailableModelIds();

	/**
	 * Only advertise model pages that actually serve requests.
	 *
	 * Most of the catalog is dark whenever an upstream provider key is
	 * missing, and a model page for a dark model is a dead end: it indexes,
	 * it ranks, and then the visitor gets an error when they try the model.
	 * Filtering keeps the sitemap honest and self-heals automatically once
	 * the provider key is restored — no deploy needed.
	 *
	 * If the catalog cannot be reached we fall back to the full static list
	 * rather than publishing an empty catalog: a transient API blip should
	 * not silently drop every model page from the index.
	 */
	const modelPages =
		availableModelIds === null
			? MODELS.map((m) => m.id)
			: MODELS.filter((m) => availableModelIds.has(m.id)).map((m) => m.id);

	return [
		entry("/", 1, "weekly"),
		// Marketing / product (public)
		entry("/models", 0.9, "daily"),
		...modelPages.map((id) => entry(`/models/${id}`, 0.8, "weekly")),
		// Free playground (no auth required for OMA-AI models) — crawlable demo.
		entry("/chat", 0.85, "weekly"),
		entry("/pricing", 0.9, "weekly"),
		entry("/docs", 0.9, "weekly"),
		entry("/getting-started", 0.85, "weekly"),
		entry("/faq", 0.7, "monthly"),
		entry("/glossary", 0.6, "monthly"),
		entry("/about", 0.6, "monthly"),
		entry("/contact", 0.4, "yearly"),
		// Operational
		entry("/status", 0.5, "daily"),
		entry("/changelog", 0.5, "weekly"),
		// Legal
		entry("/privacy", 0.25, "yearly"),
		entry("/terms", 0.25, "yearly"),
	];
}
