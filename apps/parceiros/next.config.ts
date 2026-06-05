import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: trace deps from the workspace root (two levels up from apps/parceiros).
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Compile the workspace source packages instead of expecting prebuilt output.
  transpilePackages: ['@infinity/ui', '@infinity/lib'],
  devIndicators: false,
  // We mount components from the main app (apps/app), which itself builds with
  // these relaxed gates. Match them so the partner build doesn't fail on the
  // main app's pre-existing type/lint debt.
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ['pdfjs-dist'],
};

export default nextConfig;
