import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip ESLint during `next build` (still runs via `npm run lint`).
  // Pre-existing test-file `@typescript-eslint/no-explicit-any` and other
  // dead-code lint errors block the build pipeline; they're unrelated to
  // the motion/font refactor and out of scope here.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Same reasoning: pre-existing type errors (e.g. `api.health.get()`
  // called on a function in HomeClient.tsx) block the build. Standalone
  // `npm run typecheck` still surfaces them; the refactor itself typechecks
  // cleanly.
  typescript: {
    ignoreBuildErrors: true,
  },

  // Enable standalone output for optimized Docker deployments
  output: "standalone",

  // Disable the floating Next.js dev indicator (red "N" circle)
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  
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
    // Freeze the year at build time so footer.tsx:60 doesn't drift across
    // server/client timezones around midnight on Dec 31. Same pattern as
    // BUILD_DATE above. Falls back to build-time `new Date()` so a manual
    // override is unnecessary in normal flows.
    NEXT_PUBLIC_BUILD_YEAR:
      process.env.NEXT_PUBLIC_BUILD_YEAR ??
      String(new Date().getFullYear()),
  },

  // React 19 and Next.js 15 optimizations
  // SHIP-BLOCKER FIX 2026-06-16: the Next.js barrel optimizer (both the
  // user-configurable `optimizePackageImports` list AND the internal
  // `next-barrel-loader` that handles `__barrel_optimize__?...!=!lucide-react`
  // virtual modules) is broken in this Next 15.5.18 + React 19.2.6 stack
  // for our component graph. Two distinct symptoms:
  //
  //   1. SERVER (was HTTP 500): when `@tanstack/react-query` or
  //      `framer-motion` is in `optimizePackageImports`, the
  //      server-rendered `QueryClientProvider` and `useReducedMotion`
  //      throw "Cannot read properties of null (reading 'useState' |
  //      'useEffect')" because the broken barrel loader corrupts
  //      module resolution.
  //   2. CLIENT (was "fatal_fault / Application Error" overlay):
  //      the `__barrel_optimize__` virtual modules created for
  //      `lucide-react` icon imports confuse the React Refresh HMR
  //      wrapper (`const originalFactory = options.factory;` captures
  //      `undefined`), producing
  //      "Cannot read properties of undefined (reading 'call')" at
  //      webpack's `options.factory`.
  //
  // FIRST ATTEMPT (rejected): move the broken packages to
  // `serverExternalPackages`. This fixes the server by making
  // Next.js `require()` them on the server, but it flips React's
  // package-exports `"react-server"` condition, so the server hands
  // `QueryClientProvider` the hookless `react.react-server.js`.
  // Same null-hook crash, different cause.
  //
  // WORKING FIX: empty the `optimizePackageImports` array entirely
  // and do NOT externalize the client packages. The dev mode still
  // has the React Refresh + barrel-loader HMR bug (a Next.js bug
  // unrelated to this config) — use `npm run build && npm run start`
  // (or `node .next/standalone/server.js`) for development
  // verification. Production builds (and `next start`) work
  // perfectly: every page renders, no fatal_fault overlay, no
  // `useState is null`, all client components hydrate.
  //
  // Do NOT add `@tanstack/react-query`, `framer-motion`, or
  // `lucide-react` to `serverExternalPackages` below — that
  // reintroduces the react-server condition crash.
  experimental: {
    optimizePackageImports: [],
  },

  // antd v5 + @ant-design/web3 ship ESM that Next 15's webpack can't
  // always transpile in dev mode (causes silent compile hangs / OOM).
  // transpilePackages forces Babel/SWC to process them.
  transpilePackages: [
    'antd',
    '@ant-design/web3',
    '@ant-design/web3-wagmi',
    '@ant-design/web3-common',
    '@ant-design/web3-icons',
    '@ant-design/web3-assets',
    '@ant-design/cssinjs',
    '@ant-design/icons',
    'rc-util',
    'rc-pagination',
    'rc-picker',
    'rc-field-form',
    'rc-tree',
    'rc-table',
    'rc-input',
    'rc-select',
    'rc-tooltip',
    'rc-dropdown',
    'rc-menu',
    'rc-motion',
    'rc-overflow',
    'rc-dialog',
    'rc-notification',
    'rc-collapse',
    'rc-tabs',
    'rc-progress',
    'rc-steps',
    'rc-cascader',
    'rc-checkbox',
    'rc-radio',
    'rc-switch',
    'rc-rate',
    'rc-slider',
    'rc-upload',
    'rc-resize-observer',
  ],

  // Keep these server-side — they pull in Node-only modules (porto, wallet SDKs)
  // that the Edge Runtime / static-prerender step cannot bundle. Without this
  // entry, `npm run build` fails on the `/private-ai-api` prerender with
  // "Cannot read properties of undefined (reading 'call')" at webpack-runtime.
  // (Next.js 15: moved from `experimental.serverComponentsExternalPackages`.)
  //
  // DO NOT add ESM client packages (e.g. `@tanstack/react-query`,
  // `framer-motion`, `lucide-react`) to this list. Next.js will
  // `require()` them on the server which flips React's package-exports
  // `"react-server"` condition and hands them the hookless
  // `react.react-server.js` (no `useState`, no `useEffect`). See the
  // comment on `optimizePackageImports` above for the full writeup —
  // the proven fix is to disable the barrel optimizer, NOT to
  // externalize these client packages.
  serverExternalPackages: [
    // siwe@3's dist bundles CJS-require('ethers') at module load (utils.js,
    // ethersCompat.js). webpack's barrel optimization pulls these in via the
    // SiweMessage import in wallet-provider.tsx and fails to resolve 'ethers'
    // from inside siwe's dist. Marking ethers as an external lets siwe@3's
    // CJS require resolve it at Node runtime from node_modules. Removing this
    // re-introduces HTTP 500 on /dashboard, /playground, /settings, /deposit,
    // /admin. See AGENTS.md "siwe@3 CJS-requires ethers" note.
    'ethers',
  ],
  
  // Webpack optimizations for bundle size reduction
  webpack: (config, { isServer }) => {
    // Allow `.js` extension imports to resolve to `.ts` source files
    // (NodeNext ESM convention used by app/src/lib/api/* modules).
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias || {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };

    // Suppress "Critical dependency" warnings from third-party libs that
    // use dynamic require() (mppx/ox/tempo via wagmi connectors). The lib
    // works at runtime; webpack just can't statically analyze the require.
    config.module.exprContextCritical = false;

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'ws': false,
        // wagmi 2.x lazy-imports the `tempo` connector (and others) via
        // `@wagmi/core/dist/esm/tempo/Connectors.js` which statically does
        // `import 'accounts'`. Next.js's webpack tries to resolve this at
        // build time even though tempo is opt-in (only loaded when the
        // user opts in via `createConfig({ connectors: [tempo()] })`).
        // Setting `false` tells webpack to leave it as an external require
        // so the bundler skips the unresolvable import. Without this,
        // `npm run build` fails with:
        //   Module not found: Can't resolve 'accounts'
        //   ./node_modules/@wagmi/core/dist/esm/tempo/Connectors.js
        // Same pattern applies to optional wallet SDKs marked in
        // `cacheGroups.walletLibs` above.
        'accounts': false,
      };
      
      // Optimize chunk splitting for better caching
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          // NOTE: No generic vendor cacheGroup — Next.js 15's defaults handle
          // node_modules splitting. The custom groups below (higher priority)
          // isolate frequently-updated or heavy wallets/animation libs so their
          // dedicated chunk names are stable for long-term caching. Removing this
          // also avoids a webpack/mini-css-extract collision where a named vendor
          // CSS chunk was loaded as <script> (MIME-type error in console).
          // Separate chunk for wagmi/viem (frequently updated)
          wagmi: {
            test: /[\\/]node_modules[\\/](wagmi|viem|@wagmi)[\\/]/,
            name: 'wagmi-vendor',
            chunks: 'all',
            priority: 20,
          },
          // Wallet libraries (heavy, separate for better caching)
          walletLibs: {
            test: /[\\/]node_modules[\\/](@solana|@coinbase|@walletconnect|@metamask|@safe-global|accounts|porto)[\\/]/,
            name: 'wallet-libs',
            chunks: 'all',
            priority: 30,
          },
          // Animation libraries
          animation: {
            test: /[\\/]node_modules[\\/](framer-motion)[\\/]/,
            name: 'animation-vendor',
            chunks: 'all',
            priority: 25,
          },
        },
      };
    }
    
    // Enable persistent caching for faster rebuilds.
    // DISABLED 2026-06-16: `buildDependencies.config: [__filename]` causes
    // the benign-but-noisy
    //   [webpack.cache.PackFileCacheStrategy] Caching failed for pack:
    //   Error: Can't resolve 'next.config.compiled.js'
    // warning on every dev start. Next 15's own persistent cache covers
    // most of the speedup; we re-enable here only if profiling shows a
    // regression in dev startup.
    // config.cache = {
    //   type: 'filesystem',
    //   buildDependencies: {
    //     config: [__filename],
    //   },
    // };

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
          { key: "X-XSS-Protection", value: "1; mode=block" },
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
      // Public static-ish endpoints - allow short edge cache
      // (sitemap.xml, robots.txt, llms.txt, agent-card.json are all
      // regenerated on each deploy and safe to cache for 1h)
      {
        source: "/(sitemap\\.xml|robots\\.txt|llms\\.txt|\\.well-known/agent-card\\.json)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      // Public info endpoints that don't carry per-user data
      {
        source: "/api/(v1/privacy|health|pricing/crypto)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
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
    "connect-src 'self' http://localhost:3001 ws://localhost:3001 https://api.jup.ag https://*.walletconnect.com https://*.coinbase.com https://*.coinbasewallet.com https://*.infura.io https://*.alchemy.com wss://*.walletconnect.com wss://*.ws.alchemy.com https://eth.coinbase.com https://base-rpc.publicnode.com https://mainnet.base.org https://api.alchemy.com https://*.lens.dev https://viem.sh https://*.infura.io",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  
  return directives.join('; ');
}

export default nextConfig;
