import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      { source: "/blog/:slug.md", destination: "/blog-md/:slug" },
    ];
  },
};

export default nextConfig;