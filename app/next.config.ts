import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Disable X-Powered-By header for security (information disclosure).
  poweredByHeader: false,

  // eslint.typecheck are enforced during `next build`.
  // If pre-existing errors block a needed build, fix them at the source
  // rather than silencing the compiler.
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  // Enable standalone output for optimized Docker deployments
  output: "standalone",

  // Pin the workspace root to this app's directory so Next.js doesn't
  // mis-detect /Users/tyson/ because of a stray package-lock.json there.
  outputFileTracingRoot: __dirname,

  // Build-time env injection so footer.tsx can show the real deploy SHA + date.
  // Vercel auto-sets VERCEL_GIT_COMMIT_SHA on every production deploy; we map
  // it (truncated to 7 chars) to NEXT_PUBLIC_BUILD_SHA which the footer
  // already references. Local dev without Vercel falls through to
  // NEXT_PUBLIC_BUILD_SHA if explicitly set, otherwise undefined — footer.tsx:139
  // then falls back to 'dev' via the `??` operator. BUILD_DATE defaults to
  // today's ISO date at build time.
  env: {
    NEXT_PUBLIC_BUILD_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
      process.env.NEXT_PUBLIC_BUILD_SHA,
    NEXT_PUBLIC_BUILD_DATE:
      process.env.NEXT_PUBLIC_BUILD_DATE ??
      new Date().toISOString().slice(0, 10),
  },

  // Next.js 15 + React 19: barrel optimizer enabled for client-only icon
  // libraries. lucide-react ships ~1500 named exports and is the largest
  // dependency in the client bundle; the optimizer rewrites
  //   `import { Foo, Bar } from 'lucide-react'`
  // into per-icon imports at build time, cutting the client JS by ~40 KB
  // gzip on the average page.
  //
  // framer-motion is NOT listed: it has ESM/CJS interop issues with the
  // optimizer when used alongside react-query (see git history for the
  // 2025-04 regression). Add it back only after running `next build` +
  // a smoke-test page to verify the `m.*` motion components still hydrate.
  experimental: {
    // reactCompiler: true, // DISABLED — causes "Cannot read properties of undefined (reading 'call')" on pages importing framer-motion
    optimizePackageImports: ['lucide-react'],
  },

  // FIX: framer-motion 12.x ESM entry lacks 'use client'. SWC will inject
  // it during transpilation, fixing the RSC module-resolution crash.
  //
  // 2026-06-29: BOTH transpilePackages AND the alias are needed. SWC
  // injects 'use client' into framer-motion's exports via
  // transpilePackages; the alias redirects all 'framer-motion'
  // imports through the wrapper file which adds an additional
  // 'use client' boundary and prevents framer-motion from being
  // referenced directly in the RSC module graph (which would
  // otherwise crash with "Cannot read properties of undefined").
  transpilePackages: ['framer-motion'],

  // Server-only packages (Node-only modules that break static prerendering).
  // Do NOT add ESM client packages here — they get the hookless react-server export.
  serverExternalPackages: [
    'porto',
    '@metamask/connect-evm',
    'ethers', // siwe@3 CJS-require('ethers') at module load — external required
  ],
  
  // Webpack optimizations for bundle size reduction
  webpack: (config, { isServer }) => {
    // Allow `.js` extension imports to resolve to `.ts` source files
    // (NodeNext ESM convention used by app/src/lib/api/* modules).
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };

    // FIX: framer-motion 12.x ESM entry lacks 'use client'. Next.js 15 RSC
    // treats it as a shared module → webpack module factory undefined during
    // flight hydration → "Cannot read properties of undefined (reading 'call')".
    // Alias bare 'framer-motion' to our 'use client' wrapper. The wrapper
    // itself imports from a RELATIVE path (../../node_modules/...) so the
    // alias doesn't loop back to it.
    config.resolve.alias = {
      ...config.resolve.alias,
      'framer-motion': path.resolve(__dirname, 'src/lib/framer-motion-client.tsx'),
    };

    // Suppress "Critical dependency" warnings from third-party libs that
    // use dynamic require() (mppx/ox/tempo via wagmi connectors). The lib
    // works at runtime; webpack just can't statically analyze the require.
    config.module.exprContextCritical = false;

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'ws': false,
        // tempo connector (pulled in by @wagmi/core 3.5+) needs `accounts`
        // at module load but only uses it lazily. Stub to false so webpack
        // doesn't fail the build; runtime is unaffected because the connector
        // is never invoked in this app.
        'accounts': false,
        // wagmi/connectors barrel statically imports `metaMask` and `porto`
        // connectors that this app never instantiates (we only use
        // `injected`, `coinbaseWallet`, `walletConnect`). Those connectors
        // reference `@metamask/connect-evm` and `porto/internal` which aren't
        // installed at the top level (peer of `porto` but not declared in
        // package.json). Stub to false to silence the warnings; the unused
        // connectors are dead-code-eliminated by the wagmi tree-shake.
        '@metamask/connect-evm': false,
        'porto': false,
        'porto/internal': false,
      };
      
      // Optimize chunk splitting for better caching
      // DISABLED custom cacheGroups — caused "Cannot read properties of undefined (reading 'call')"
      // on pages importing framer-motion. The animation-vendor chunk was split in a way
      // that webpack couldn't resolve at runtime. Re-enable after testing with default splitting.
      // config.optimization.splitChunks = { ... };
    }
    
    return config;
  },
  
  // Compiler optimizations
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
    // Optimize for performance
    reactRemoveProperties: process.env.NODE_ENV === 'production' 
      ? { properties: ['^data-test-id$'] } 
      : false,
  },
  
  // Redirect broken /about route to /about-us (bundler conflict workaround)
  async redirects() {
    return [
      {
        source: '/about',
        destination: '/about-us',
        permanent: true,
      },
    ];
  },

  // API rewrites for proxy to backend
  // Exclude /api/admin/* — those paths have file-based route handlers in
  // app/src/app/api/admin/* that take priority over the rewrite. Without
  // this exclusion, dynamic segments like /api/admin/users/[id] would
  // fall through to the rewrite (shadowing the file route) and return 500
  // when the backend is unreachable.
  async rewrites() {
    return [
      {
        // Non-admin API paths (chat, health, pricing, v1/*) → backend
        source: "/api/:path((?!admin).*)",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/:path*`,
      },
    ];
  },
  
  // Security and performance headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: generateContentSecurityPolicy(),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { 
            key: "Strict-Transport-Security", 
            value: "max-age=63072000; includeSubDomains; preload" 
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // Static asset caching headers
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // API routes - no cache
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
      // HTML pages - no cache
      {
        source: "/(.*)\\.(html|htm)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate, proxy-revalidate",
          },
        ],
      },
    ];
  },
  
  // Image optimization configuration
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "oma-ai.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    // Enable modern formats for better compression
    formats: ['image/avif', 'image/webp'],
    // Disable image optimization for static SVG files
    disableStaticImages: false,
  },
};

/**
 * Generate Content Security Policy header.
 * This is more maintainable than writing it inline.
 */
function generateContentSecurityPolicy(): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://verify.walletconnect.com https://*.walletconnect.com https://*.coinbase.com https://*.coinbasewallet.com",
    "style-src 'self' 'unsafe-inline'", // Required for Tailwind
    "img-src 'self' data: https: blob:",
    "font-src 'self'",
    "frame-src 'self' https://verify.walletconnect.com https://*.walletconnect.com https://*.coinbase.com https://*.coinbasewallet.com",
    "connect-src 'self' http://localhost:3001 ws://localhost:3001 https://api.jup.ag https://*.walletconnect.com https://api.web3modal.org https://*.coinbase.com https://*.coinbasewallet.com https://*.infura.io https://*.alchemy.com wss://*.walletconnect.com wss://*.ws.alchemy.com https://eth.coinbase.com https://base-rpc.publicnode.com https://api.alchemy.com https://*.lens.dev https://viem.sh https://*.infura.io https://*.ingest.sentry.io https://*.sentry.io",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  
  return directives.join('; ');
}

export default withSentryConfig(nextConfig, {
  // Sentry build options — source-map upload is disabled when
  // SENTRY_AUTH_TOKEN is absent so local / CI builds don't fail.
  org: process.env.SENTRY_ORG || "oma-ai",
  project: process.env.SENTRY_PROJECT || "oma-app",
  silent: !process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
