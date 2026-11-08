/**
	* Permanent redirects for removed marketing / legacy surfaces.
	* Single source of truth — consumed by `next.config.ts` and unit tests.
	*/
type SiteRedirect = {
	source: string;
	destination: string;
};

export const SITE_REDIRECTS: readonly SiteRedirect[] = [
	{ source: "/models/deepseek-v4-flash-0731-openbroker", destination: "/models/deepseek-v4-flash-0731#deepseek-v4-flash-0731-openbroker" },
	// /about restored as a live E-E-A-T page (no longer redirects)
	// /faq restored as a live public page (no longer redirects)
	{ source: "/blog", destination: "/docs" },
	{ source: "/blog/:path*", destination: "/docs" },
	{ source: "/capabilities", destination: "/models" },
	{ source: "/compare", destination: "/models" },
	// Retired standalone surfaces from the pre-gateway product.
	{ source: "/compute", destination: "/models" },
	{ source: "/compute/:path*", destination: "/models" },
	{ source: "/wallet", destination: "/getting-started" },
	{ source: "/wallet/:path*", destination: "/getting-started" },
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
	{ source: "/api-keys", destination: "/dashboard?tab=api-keys" },
	// AUP merged into Terms ("Acceptable use" section) — single legal doc.
	{ source: "/aup", destination: "/terms#acceptable-use" },
	// Internal motion/design-system reference page removed — point at docs.
	{ source: "/design", destination: "/docs" },
	{ source: "/design/:path*", destination: "/docs" },
	// AUDIT 2026-11-01 (GSC, 90d): these three URLs are still IN Google's
	// index and still earning impressions, but the pages were removed and
	// answer 404. Each 404 wastes an impression Google already paid to
	// earn — measured 38 impressions over 90d on the property.
	//
	//   /changelog     27 impr, avg pos 4.7 — ranks for the BRAND queries
	//                  ("ai oma" pos 9.5, "oma ai" pos 9, "oma ia" pos 8)
	//                  while the homepage already ranks "oma ai" at pos 2.4.
	//                  The impressions are for the homepage's own query, so
	//                  they belong on the homepage: 301 → "/".
	//   /mcps          6 impr, avg pos 4.0 — the retired "MCP Marketplace".
	//                  The live MCP reference page is the glossary entry.
	//   /glossary/a2a  5 impr, pos 7.4 for "what is a2a" — the A2A glossary
	//                  entry was retired in 50e4824b (the slug no longer
	//                  exists in GLOSSARY_SLUGS, so /glossary/[slug] 404s).
	//                  The glossary index is the live page for it.
	{ source: "/changelog", destination: "/" },
	{ source: "/mcps", destination: "/glossary/mcp" },
	{ source: "/glossary/a2a", destination: "/glossary" },
] as const;

/** Exact legacy paths that must never appear as live sitemap URLs. */
export const REMOVED_PUBLIC_PATHS = [
	"/blog",
	"/capabilities",
	"/compare",
	"/compute",
	"/wallet",
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
	"/api-keys",
	"/aup",
	"/design",
	// AUDIT 2026-11-01: still indexed by Google, but the pages were removed.
	// Listed here so the sitemap can never re-add them AND so
	// site-redirects.test.ts enforces a permanent mapping for each.
	"/changelog",
	"/mcps",
	"/glossary/a2a",
] as const;
