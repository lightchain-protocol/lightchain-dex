import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Optional wallet connector peers (wagmi / AppKit) — not installed, but
    // webpack still tries to resolve their dynamic imports at build time.
    config.externals.push(
      "pino-pretty",
      "lokijs",
      "encoding",
      "porto",
      "accounts"
    );

    return config;
  },
};

export default nextConfig;
