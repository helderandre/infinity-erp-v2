import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@infinity/ui', '@infinity/lib'],
  devIndicators: false,
};

export default nextConfig;
