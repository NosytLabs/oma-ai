import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for optimized Docker deployments
  output: "standalone",
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
  },

  // React 19 and Next.js 15 optimizations
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      'framer-motion', 
      'recharts',
      '@tanstack/react-query',
      'react-markdown',
    ],
  },

  // Keep these server-side — they pull in Node-only modules (porto, wallet SDKs)
  // that the Edge Runtime / static-prerender step cannot bundle. Without this
  // entry, `npm run build` fails on the `/private-ai-api` prerender with
  // "Cannot read properties of undefined (reading 'call')" at webpack-runtime.
  // (Next.js 15: moved from `experimental.serverComponentsExternalPackages`.)
  serverExternalPackages: [
    'porto',
    '@metamask/connect-evm',
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
      };
      
      // Optimize chunk splitting for better caching
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          // Vendor chunk for node_modules
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
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
    
    // Enable persistent caching for faster rebuilds
    config.cache = {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    };
    
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
    "connect-src 'self' https://api.jup.ag https://*.walletconnect.com https://*.coinbase.com https://*.coinbasewallet.com https://*.infura.io https://*.alchemy.com wss://*.walletconnect.com wss://*.ws.alchemy.com https://eth.coinbase.com https://base-rpc.publicnode.com https://api.alchemy.com https://*.lens.dev https://viem.sh https://*.infura.io",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  
  return directives.join('; ');
}

export default nextConfig;
