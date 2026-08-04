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
	// /faq restored as a live public page (no longer redirects)
	{ source: "/blog", destination: "/changelog" },
	{ source: "/blog/:path*", destination: "/changelog" },
	{ source: "/status", destination: "/docs#endpoints" },
	{ source: "/support", destination: "/contact" },
	{ source: "/signup", destination: "/login" },
	{ source: "/disclosures", destination: "/privacy#subprocessors" },
	{ source: "/provenance", destination: "/docs" },
	{ source: "/playground", destination: "/chat" },
	{ source: "/playground/:path*", destination: "/chat/:path*" },
	// Standalone API-reference catalog merged into the docs endpoint reference.
	{ source: "/network", destination: "/docs#endpoints" },
	{ source: "/network/:path*", destination: "/docs#endpoints" },
	// Image/video playgrounds merged into unified /chat media modes
	// (OpenRouter-style single playground with modality tabs).
	{ source: "/image-generation", destination: "/chat?mode=image" },
	{ source: "/image-generation/:path*", destination: "/chat?mode=image" },
	{ source: "/video-generation", destination: "/chat?mode=video" },
	{ source: "/video-generation/:path*", destination: "/chat?mode=video" },
	// Swap provider retired — fund via direct USDC deposit
	{ source: "/swap", destination: "/deposit" },
	{ source: "/swap/:path*", destination: "/deposit" },
	// Legacy account/credits shortcuts.
	{ source: "/credits", destination: "/deposit" },
	{ source: "/account", destination: "/settings" },
	// AUP merged into Terms ("Acceptable use" section) — single legal doc.
	{ source: "/aup", destination: "/terms#acceptable-use" },
	// Internal motion/design-system reference page removed — point at docs.
	{ source: "/design", destination: "/docs" },
	{ source: "/design/:path*", destination: "/docs" },
] as const;

/** Exact legacy paths that must never appear as live sitemap URLs. */
export const REMOVED_PUBLIC_PATHS = [
	"/blog",
	"/status",
	"/support",
	"/signup",
	"/disclosures",
	"/provenance",
	"/playground",
	"/image-generation",
	"/video-generation",
	"/network",
	"/swap",
	"/credits",
	"/account",
	"/aup",
	"/design",
] as const;
