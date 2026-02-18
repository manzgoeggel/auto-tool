import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: '.',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.classistatic.de',
      },
      {
        protocol: 'https',
        hostname: '*.mobile.de',
      },
    ],
  },
};

export default nextConfig;
