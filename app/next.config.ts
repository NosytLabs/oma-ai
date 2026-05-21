import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/:path*`,
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
        accounts: false,
        'ws': false,
      };
    }
    return config;
  },
};

export default nextConfig;
