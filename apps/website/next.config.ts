import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Monorepo: trace deps from the workspace root (two levels up from apps/website).
  outputFileTracingRoot: path.join(__dirname, "../../"),
  devIndicators: false,
  // Faithful 1:1 port of a Figma-exported SPA — don't fail the build on the
  // upstream's pre-existing type debt. Tighten incrementally later.
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "umlndumjfamfsswwjgoo.supabase.co" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default nextConfig;
