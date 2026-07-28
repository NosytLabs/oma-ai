/**
 * Permanent redirects for removed marketing / legacy surfaces.
 * Single source of truth — consumed by `next.config.ts` and unit tests.
 */
export type SiteRedirect = {
	source: string;
	destination: string;
};

export const SITE_REDIRECTS: readonly SiteRedirect[] = [
	// /about restored as a live E-E-A-T page (no longer redirects)
	{ source: "/faq", destination: "/pricing#faq" },
	{ source: "/faq/:path*", destination: "/pricing#faq" },
	{ source: "/blog", destination: "/changelog" },
	{ source: "/blog/:path*", destination: "/changelog" },
	{ source: "/status", destination: "/network" },
	{ source: "/support", destination: "/contact" },
	{ source: "/signup", destination: "/login" },
	{ source: "/disclosures", destination: "/privacy#subprocessors" },
	{ source: "/provenance", destination: "/docs" },
	{ source: "/playground", destination: "/chat" },
	{ source: "/playground/:path*", destination: "/chat/:path*" },
	// Image/video playgrounds merged into unified /chat media modes
	// (OpenRouter-style single playground with modality tabs).
	{ source: "/image-generation", destination: "/chat?mode=image" },
	{ source: "/image-generation/:path*", destination: "/chat?mode=image" },
	{ source: "/video-generation", destination: "/chat?mode=video" },
	{ source: "/video-generation/:path*", destination: "/chat?mode=video" },
	// Swap provider retired — fund via direct USDC deposit
	{ source: "/swap", destination: "/deposit" },
	{ source: "/swap/:path*", destination: "/deposit" },
	// Legacy account/credits shortcuts (also handled in middleware)
	{ source: "/credits", destination: "/dashboard/credits" },
	{ source: "/account", destination: "/settings" },
] as const;

/** Exact legacy paths that must never appear as live sitemap URLs. */
export const REMOVED_PUBLIC_PATHS = [
	"/blog",
	"/faq",
	"/status",
	"/support",
	"/signup",
	"/disclosures",
	"/provenance",
	"/playground",
	"/image-generation",
	"/video-generation",
	"/swap",
	"/credits",
	"/account",
] as const;
