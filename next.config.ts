import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Esconde o indicador "N" flutuante do Next.js dev (canto inferior esquerdo).
  // Aparece só em desenvolvimento mas atrapalha a leitura visual de mockups e
  // formulários cheios — sobretudo em mobile.
  devIndicators: false,
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
