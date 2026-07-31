import type { NextConfig } from "next";
import { SITE_REDIRECTS } from "./src/lib/site-redirects";

const nextConfig: NextConfig = {
	poweredByHeader: false,

	eslint: { ignoreDuringBuilds: false },
	typescript: { ignoreBuildErrors: false },

	// Next.js 15 dev server sends `Content-Encoding: gzip` on streamed RSC
	// responses while the body is plain text — Chrome logs
	// ERR_CONTENT_DECODING_FAILED and renders an empty page (e.g. /models).
	// Disable dev compression; production uses a reverse proxy for gzip.
	compress: false,

	output: "standalone",
	outputFileTracingRoot: __dirname,

	env: {
		NEXT_PUBLIC_BUILD_SHA:
			process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
			process.env.NEXT_PUBLIC_BUILD_SHA ??
			"dev",
		// Hardcode the fallback to a stable string so SSR and CSR agree
		// (avoids the `new Date()`-at-config-eval-time server/client
		// hydration mismatch). Bump in source on each deploy.
		NEXT_PUBLIC_BUILD_DATE:
			process.env.NEXT_PUBLIC_BUILD_DATE ??
			"2026-07-26",
	},

	experimental: {},
	transpilePackages: [],

	serverExternalPackages: ["porto", "@metamask/connect-evm", "ethers"],

	webpack: (config, { isServer }) => {
		config.resolve.extensionAlias = {
			...(config.resolve.extensionAlias || {}),
			".js": [".ts", ".tsx", ".js", ".jsx"],
		};
		config.module.exprContextCritical = false;

		if (!isServer) {
			config.resolve.alias = {
				...(config.resolve.alias || {}),
				"porto/internal": false,
			};
			config.resolve.fallback = {
				...config.resolve.fallback,
				ws: false,
				accounts: false,
				"@metamask/connect-evm": false,
				"@base-org/account": false,
				"@coinbase/wallet-sdk": false,
				"@safe-global/safe-apps-sdk": false,
				"@safe-global/safe-apps-provider": false,
				"@walletconnect/ethereum-provider": false,
				porto: false,
				"porto/internal": false,
			};
		}
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

	async rewrites() {
		// NOTE: Do NOT rewrite `/api/*` to the Hono backend. App Router handlers
		// under `app/api/**` (incl. catch-all) translate the HttpOnly session
		// cookie into `Authorization: Bearer` before proxying. A rewrite would
		// skip that and 401 every authenticated call after hard reload.
		const apiRewriteDestination = (() => {
			const url = process.env.NEXT_PUBLIC_API_URL;
			return url?.trim() ? url : "http://127.0.0.1:3001";
		})();
		return [
			// The facilitator serves /x402/verify + /x402/settle (NO /v1 prefix) —
			// the old /v1/x402 destination 404'd the payment endpoint advertised
			// in .well-known/agent-card.json.
			{ source: "/x402/:path*", destination: `${apiRewriteDestination}/x402/:path*` },
		];
	},

	async headers() {
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
			{ source: "/_next/static/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
			{ source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate" }] },
			{ source: "/(.*)\\.(html|htm)", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate, proxy-revalidate" }] },
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
	// Production drops it; no wallet connectors that need eval remain.
	const isDev = process.env.NODE_ENV !== "production";
	const scriptSrc = [
		"'self'",
		isDev ? "'unsafe-eval'" : null,
		"'unsafe-inline'", // Next.js inline bootstraps + theme FOUC script
	].filter(Boolean).join(" ");

	const connectSrc = [
		"'self'",
		// Local API only needed in dev; harmless if present in prod builds used locally
		...(isDev ? ["http://localhost:3001", "ws://localhost:3001", "http://127.0.0.1:3001"] : []),
		// Public RPC fallbacks used by the injected wallet for read-only chain calls
		"https://*.infura.io",
		"https://*.alchemy.com",
		"wss://*.ws.alchemy.com",
		"https://base-rpc.publicnode.com",
		"https://api.alchemy.com",
		// Production API host (same-origin /api proxy is preferred; allow direct too)
		"https://api.oma-ai.com",
		"https://oma-ai.com",
	].join(" ");

	const directives = [
		"default-src 'self'",
		`script-src ${scriptSrc}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: https: blob:",
		"font-src 'self'",
		"frame-src 'self'",
		`connect-src ${connectSrc}`,
		// Align with X-Frame-Options: DENY — block all framing (clickjacking).
		"frame-ancestors 'none'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"upgrade-insecure-requests",
	];
	return directives.join("; ");
}

export default nextConfig;