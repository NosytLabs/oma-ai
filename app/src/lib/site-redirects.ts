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
	{ source: "/blog", destination: "/docs" },
	{ source: "/blog/:path*", destination: "/docs" },
	{ source: "/capabilities", destination: "/models" },
	{ source: "/compare", destination: "/models" },
	{ source: "/support", destination: "/contact" },
	{ source: "/signup", destination: "/login" },
	// Common auth URL aliases — product is passwordless magic-link/SIWE only.
	{ source: "/sign-in", destination: "/login" },
	{ source: "/sign-up", destination: "/login" },
	{ source: "/register", destination: "/login" },
	{ source: "/signin", destination: "/login" },
	{ source: "/disclosures", destination: "/privacy#subprocessors" },
	{ source: "/provenance", destination: "/docs" },
	{ source: "/playground", destination: "/chat" },
	{ source: "/playground/:path*", destination: "/chat" },
	// Standalone API-reference catalog merged into the docs endpoint reference.
	{ source: "/network", destination: "/docs#endpoints" },
	{ source: "/network/:path*", destination: "/docs#endpoints" },
	// Image/video generation was removed — redirect legacy deep links
	// to the unified text/multimodal chat surface.
	{ source: "/image-generation", destination: "/chat" },
	{ source: "/image-generation/:path*", destination: "/chat" },
	{ source: "/video-generation", destination: "/chat" },
	{ source: "/video-generation/:path*", destination: "/chat" },
	{ source: "/create", destination: "/chat" },
	{ source: "/studio", destination: "/chat" },
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
	"/capabilities",
	"/compare",
	"/support",
	"/signup",
	"/sign-in",
	"/sign-up",
	"/register",
	"/signin",
	"/disclosures",
	"/provenance",
	"/playground",
	"/image-generation",
	"/video-generation",
	"/create",
	"/studio",
	"/network",
	"/swap",
	"/credits",
	"/account",
	"/aup",
	"/design",
] as const;
