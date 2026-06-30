import type { Metadata } from "next";
import "./globals.css";
import { RootProviders } from "./providers";
import { SiteChrome } from "./site-chrome";

const SITE_URL = "https://infinitygroup.pt";
const OG_IMAGE =
  "https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/logoinfitiy.png";
const DESCRIPTION =
  "Encontre a sua casa de sonho com a Infinity Group. Especialistas em compra, venda e arrendamento de imóveis em Portugal.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Infinity Group - Agência Imobiliária",
    template: "%s | Infinity Group",
  },
  description: DESCRIPTION,
  applicationName: "Infinity Group",
  icons: { icon: OG_IMAGE },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Infinity Group",
    title: "Infinity Group - Agência Imobiliária",
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Infinity Group Logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Infinity Group - Agência Imobiliária",
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: "Infinity Group",
  description: DESCRIPTION,
  url: SITE_URL,
  logo: OG_IMAGE,
  image: OG_IMAGE,
  areaServed: "PT",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <RootProviders>
          <SiteChrome>{children}</SiteChrome>
        </RootProviders>
      </body>
    </html>
  );
}
