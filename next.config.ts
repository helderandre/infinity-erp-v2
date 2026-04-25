import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['pdfjs-dist'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/dashboard/comissoes',
        destination: '/dashboard/financeiro',
        permanent: true,
      },
      {
        source: '/dashboard/comissoes/:path*',
        destination: '/dashboard/financeiro/:path*',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
