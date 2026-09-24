import type { MetadataRoute } from "next";
import { MODELS } from "@/lib/models-data";
import { isModelAvailable } from "@/lib/model-availability";

/**
 * Hard ceiling on the catalog read. A hung upstream must never stall the
 * whole build; the abort turns an indefinite wait into the fail-closed path.
 */
const CATALOG_TIMEOUT_MS = 5_000;

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
		const res = await fetch(url, {
			next: { revalidate: 300 },
			signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
		});
		if (!res.ok) return null;
		const json = (await res.json()) as {
			data?: { id?: string; available?: boolean }[];
		};
		if (!Array.isArray(json.data)) return null;
		return new Set(
			json.data.filter((m) => m.id && isModelAvailable(m)).map((m) => m.id as string),
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
	 * When the catalog cannot be read we FAIL CLOSED in production: publish
	 * no model pages rather than the whole static list. The old behaviour
	 * (fall back to every model) turned a transient build-time network blip
	 * into 18 dead pages permanently advertised in production — exactly the
	 * soft-404 this filter exists to prevent. Omitting them is recoverable
	 * on the next deploy; ranking an error page is not.
	 *
	 * Dev keeps the permissive fallback: there are no SEO stakes locally and
	 * a full catalog is the more useful debugging surface.
	 */
	const modelPages =
		availableModelIds === null
			? process.env.NODE_ENV === "production"
				? []
				: MODELS.map((m) => m.id)
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
