import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	poweredByHeader: false,

	eslint: { ignoreDuringBuilds: false },
	typescript: { ignoreBuildErrors: false },

	output: "standalone",
	outputFileTracingRoot: __dirname,

	env: {
		NEXT_PUBLIC_BUILD_SHA:
			process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
			process.env.NEXT_PUBLIC_BUILD_SHA,
		NEXT_PUBLIC_BUILD_DATE:
			process.env.NEXT_PUBLIC_BUILD_DATE ??
			new Date().toISOString().slice(0, 10),
	},

	experimental: { optimizePackageImports: ["lucide-react"] },
	transpilePackages: [],

	serverExternalPackages: ["porto", "@metamask/connect-evm", "ethers"],

	webpack: (config, { isServer }) => {
		config.resolve.extensionAlias = {
			...(config.resolve.extensionAlias || {}),
			".js": [".ts", ".tsx", ".js", ".jsx"],
		};
		config.module.exprContextCritical = false;

		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				ws: false,
				accounts: false,
				"@metamask/connect-evm": false,
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

	async redirects() { return []; },

	async rewrites() {
		const apiRewriteDestination = (() => {
			const url = process.env.NEXT_PUBLIC_API_URL;
			return url?.trim() ? url : "http://127.0.0.1:9999";
		})();
		return [
			{ source: "/api/:path((?!admin).*)", destination: `${apiRewriteDestination}/:path*` },
			{ source: "/x402/:path*", destination: `${apiRewriteDestination}/v1/x402/:path*` },
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
	const directives = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-eval' 'unsafe-inline' https://verify.walletconnect.com https://*.walletconnect.com https://*.coinbase.com https://*.coinbasewallet.com",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: https: blob:",
		"font-src 'self'",
		"frame-src 'self' https://verify.walletconnect.com https://*.walletconnect.com https://*.coinbase.com https://*.coinbasewallet.com",
		"connect-src 'self' http://localhost:3001 ws://localhost:3001 https://api.jup.ag https://*.walletconnect.com https://api.web3modal.org https://*.coinbase.com https://*.coinbasewallet.com https://*.infura.io https://*.alchemy.com wss://*.walletconnect.com wss://*.ws.alchemy.com https://eth.coinbase.com https://base-rpc.publicnode.com https://api.alchemy.com https://*.lens.dev https://viem.sh https://*.infura.io https://*.ingest.sentry.io https://*.sentry.io",
		"frame-ancestors 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
	];
	return directives.join("; ");
}

export default withSentryConfig(nextConfig, {
	org: process.env.SENTRY_ORG || "oma-ai",
	project: process.env.SENTRY_PROJECT || "oma-app",
	silent: !process.env.SENTRY_AUTH_TOKEN,
	sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});