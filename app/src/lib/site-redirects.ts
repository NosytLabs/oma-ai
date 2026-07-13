/**
 * Permanent redirects for removed marketing / legacy surfaces.
 * Single source of truth — consumed by `next.config.ts` and unit tests.
 */
export type SiteRedirect = {
	source: string;
	destination: string;
};

export const SITE_REDIRECTS: readonly SiteRedirect[] = [
	{ source: "/about", destination: "/" },
	{ source: "/about/:path*", destination: "/" },
	{ source: "/faq", destination: "/pricing#faq" },
	{ source: "/faq/:path*", destination: "/pricing#faq" },
	{ source: "/blog", destination: "/changelog" },
	{ source: "/blog/:path*", destination: "/changelog" },
	{ source: "/status", destination: "/network" },
	{ source: "/support", destination: "/docs" },
	{ source: "/signup", destination: "/login" },
	{ source: "/disclosures", destination: "/terms" },
	{ source: "/provenance", destination: "/docs" },
	{ source: "/playground", destination: "/chat" },
	{ source: "/playground/:path*", destination: "/chat/:path*" },
] as const;

/** Exact legacy paths that must never appear as live sitemap URLs. */
export const REMOVED_PUBLIC_PATHS = [
	"/about",
	"/blog",
	"/faq",
	"/status",
	"/support",
	"/signup",
	"/disclosures",
	"/provenance",
	"/playground",
] as const;
