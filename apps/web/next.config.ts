import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @bolo/core ships TypeScript source from the workspace
  transpilePackages: ["@bolo/core"],
  // A second dev server (e.g. tests on throwaway data) needs its own build folder
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The floating dev badge would otherwise end up inside rendered creatives
  devIndicators: false,
  // Headless Chromium for rendering creatives — load from node_modules, don't bundle
  serverExternalPackages: ["playwright", "playwright-core"],
  experimental: {
    serverActions: { bodySizeLimit: "200mb" },
  },
};

export default nextConfig;
