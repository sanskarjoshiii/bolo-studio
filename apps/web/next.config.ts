import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @bolo/core ships TypeScript source from the workspace
  transpilePackages: ["@bolo/core"],
  // The floating dev badge would otherwise end up inside rendered creatives
  devIndicators: false,
  // Headless Chromium for rendering creatives — load from node_modules, don't bundle
  serverExternalPackages: ["playwright", "playwright-core"],
  experimental: {
    serverActions: { bodySizeLimit: "200mb" },
  },
};

export default nextConfig;
