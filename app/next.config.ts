import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'wagmi', 'viem'],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://verify.walletconnect.com https://*.walletconnect.com https://*.coinbase.com https://*.coinbasewallet.com; frame-src 'self' https://*.coinbase.com https://*.coinbasewallet.com; connect-src 'self' https://api.jup.ag https://*.walletconnect.com https://*.coinbase.com https://*.coinbasewallet.com https://*.infura.io https://*.alchemy.com wss://*.walletconnect.com wss://*.ws.alchemy.com https://eth.coinbase.com https://base-rpc.publicnode.com https://api.alchemy.com https://*.lens.dev https://viem.sh https://*.infura.io; frame-ancestors 'self';",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "oma-ai.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'ws': false,
      };
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          wagmi: {
            test: /[\\/]node_modules[\\/](wagmi|viem|@wagmi)[\\/]/,
            name: 'wagmi-vendor',
            chunks: 'all',
            priority: 20,
          },
        },
      };
    }
    return config;
  },
};

export default nextConfig;
