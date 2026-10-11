import path from "node:path";
import type { NextConfig } from "next";
import { SITE_REDIRECTS } from "./src/lib/site-redirects";
import nextBundleAnalyzer from "@next/bundle-analyzer";
import { walletConnectProjectId, WALLETCONNECT_CONNECT_ORIGINS, WALLETCONNECT_FRAME_ORIGINS } from "./src/lib/wallet-connect-config";

const withBundleAnalyzer = nextBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
	devIndicators: false,
	poweredByHeader: false,

	// Next 16 removed the `eslint` config key entirely; the standalone
	// `lint` script still runs eslint via the CLI. Keeping the key here is a
	// hard TS2353 type error on NextConfig.
	typescript: { ignoreBuildErrors: false },

	// Next.js 15 dev server sends `Content-Encoding: gzip` on streamed RSC
	// responses while the body is plain text — Chrome logs
	// ERR_CONTENT_DECODING_FAILED and renders an empty page (e.g. /models).
	// Disable dev compression; production uses a reverse proxy for gzip.
	compress: false,

	output: "standalone",

	// This app is one package inside a pnpm monorepo. With node-linker=hoisted,
	// Next.js itself lives in the repository-root node_modules, not app/node_modules.
	// Trace from the monorepo root so Vercel can package runtime dependencies that
	// sit outside the Next.js project directory.
	outputFileTracingRoot: path.join(__dirname, ".."),

	// Next 15.5.x externalizes runtime helpers from server.runtime.prod.js, and
	// Vercel file tracing can miss them when Next is hoisted outside app/.
	// Include the required helpers from the actual monorepo-root package path.
	outputFileTracingIncludes: {
		"/*": [
			"../node_modules/next/dist/compiled/source-map/**/*",
			"../node_modules/next/dist/compiled/stacktrace-parser/**/*",
		],
	},

	env: {
		NEXT_PUBLIC_BUILD_SHA:
			process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
			process.env.NEXT_PUBLIC_BUILD_SHA ??
			"dev",
		// NEXT_PUBLIC_BUILD_DATE was removed: nothing in app/src read it, so
		// the hardcoded "2026-09-04" fallback was manual busywork ("bump in
		// source on each deploy") feeding a value no consumer ever saw. If a
		// build timestamp is genuinely wanted, derive it from the Vercel build
		// environment at request time rather than pinning a literal in source.
	},

	serverExternalPackages: [],

	webpack: (config) => {
		config.resolve.extensionAlias = {
			...(config.resolve.extensionAlias || {}),
			".js": [".ts", ".tsx", ".js", ".jsx"],
		};
		config.module.exprContextCritical = false;

		return config;
	},

	compiler: {
		removeConsole: process.env.NODE_ENV === "production",
		reactRemoveProperties:
			process.env.NODE_ENV === "production"
				? { properties: ["^data-test-id$"] }
				: false,
	},

	async redirects() {
		// Removed marketing surfaces → keep SEO juice & bookmarks alive.
		// Source list: src/lib/site-redirects.ts (unit-tested).
		return SITE_REDIRECTS.map((r) => ({ ...r, permanent: true as const }));
	},

	async headers() {
		// Dev-mode static chunks must NOT be cached forever: without this,
		// the browser keeps running stale JS after a code change (breaks
		// hydration, event handlers, and model-name overrides) until a hard
		// refresh. Production keeps hashed immutable chunks.
		const isDev = process.env.NODE_ENV !== "production";
		return [
			{
				source: "/(.*)",
				headers: [
					{ key: "Content-Security-Policy", value: generateContentSecurityPolicy() },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "X-Frame-Options", value: "DENY" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
					{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
					{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
				],
			},
			{
				source: "/api/:path*",
				headers: [
					{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
				],
			},
			// Keep app/auth surfaces dynamic. These routes either vary by the
			// session or render the heavy authenticated shell; caching them at
			// the edge risks serving one user's response to another.
			...["/chat/:path*", "/dashboard/:path*", "/settings/:path*", "/login/:path*", "/deposit/:path*", "/admin/:path*"].map(
				(source) => ({
					source,
					headers: [
						{
							key: "Cache-Control",
							value: "no-store, no-cache, must-revalidate",
						},
					],
				}),
			),
			// Stable public marketing documents may be cached briefly at the CDN
			// and revalidated in the background. Next still controls the RSC
			// request/response protocol; this only sets the outer HTTP cache.
			//
			// /status is deliberately NOT in this list. It is a per-request
			// liveness probe (`dynamic = "force-dynamic"` in app/src/app/status/
			// page.tsx) — caching it here would re-freeze the health snapshot at
			// the edge for an hour, which is the exact bug force-dynamic fixes at
			// the origin. It now falls through to Next's own no-store handling
			// for dynamic routes.
			...["/", "/pricing/:path*", "/docs/:path*", "/models/:path*", "/getting-started", "/about", "/faq", "/glossary/:path*", "/privacy", "/terms", "/contact", "/changelog"].map(
				(source) => ({
					source,
					headers: [
						{
							key: "Cache-Control",
							value: isDev
								? "no-cache, no-store, must-revalidate"
								: "public, s-maxage=3600, stale-while-revalidate=86400",
						},
					],
				}),
			),
		];
	},

	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "oma-ai.com" },
			{ protocol: "https", hostname: "**.cloudfront.net" },
			{ protocol: "https", hostname: "lh3.googleusercontent.com" },
		],
		formats: ["image/avif", "image/webp"],
		disableStaticImages: false,
	},
};

function generateContentSecurityPolicy(): string {
	// 'unsafe-eval' only in development (Next HMR / React Refresh).
	// Production drops it; neither wallet adapter requires eval.
	const isDev = process.env.NODE_ENV !== "production";
	const walletConnectEnabled = Boolean(walletConnectProjectId());
	const scriptSrc = [
		"'self'",
		isDev ? "'unsafe-eval'" : null,
		"'unsafe-inline'", // Next.js inline bootstraps + theme FOUC script
		// Google Analytics 4 (gtag.js). Gated on the same env var the
		// <GoogleAnalytics> component reads, so a build without the ID also
		// does not widen its CSP.
		process.env.NEXT_PUBLIC_GA_ID ? "https://www.googletagmanager.com" : null,
	].filter(Boolean).join(" ");

	const connectSrc = [
		"'self'",
		...(walletConnectEnabled ? WALLETCONNECT_CONNECT_ORIGINS : []),
		// Local API — only for a locally-run dev server. Gated on the
		// environment for the same reason 'unsafe-eval' is: a production CSP
		// allowing connect-src to localhost is NOT harmless remotely. It lets
		// any injected script send requests to services on the *visitor's* own
		// machine (a local wallet, bridge, or dev server listening on 3001)
		// and read the response. The old comment claimed "harmless remotely",
		// which is exactly backwards.
		isDev ? "http://localhost:3001" : null,
		isDev ? "ws://localhost:3001" : null,
		isDev ? "http://127.0.0.1:3001" : null,
		// Public RPC fallbacks used by the injected wallet for read-only chain calls
		"https://*.infura.io",
		"https://*.alchemy.com",
		"wss://*.ws.alchemy.com",
		"https://base-rpc.publicnode.com",
		"https://api.alchemy.com",
		// The API is same-origin via the /api proxy on Vercel, so 'self'
		// already covers it. `https://api.oma-ai.com` was listed here but the
		// host has no DNS record (NXDOMAIN) — a dead entry that can never
		// match. Remove it rather than keep a phantom host in the policy.
		"https://oma-ai.com",
		// GA4 beacons post here; the wildcard covers regional endpoints.
		process.env.NEXT_PUBLIC_GA_ID
			? "https://www.google-analytics.com https://region1.google-analytics.com"
			: null,
	]
		.filter(Boolean)
		.join(" ");

	const directives = [
		"default-src 'self'",
		`script-src ${scriptSrc}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: https: blob:",
		"font-src 'self'",
		`frame-src 'self'${walletConnectEnabled ? ` ${WALLETCONNECT_FRAME_ORIGINS.join(" ")}` : ""}`,
		`connect-src ${connectSrc}`,
		// Align with X-Frame-Options: DENY — block all framing (clickjacking).
		"frame-ancestors 'none'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
	];
	return directives.join("; ");
}

// Note: Use `npx @next/codemod@latest next-experimental-turbo-to-turbopack .` and reference Vercel docs to migrate to turbopack advanced mode if needed.

module.exports = withBundleAnalyzer(nextConfig);
