import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Albert_Sans } from "next/font/google";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import { Toaster } from "@/components/ui/sonner";
import { UploadPanel } from "@/components/shared/upload-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { SplashScreen } from "@/components/shared/splash-screen";

const albertSans = Albert_Sans({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "ERP Infinity | Gestão Imobiliária",
  description: "Sistema de gestão interno para a Infinity Group - Imobiliária em Portugal",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Infinity ERP",
    startupImage: "/icon-512.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className={albertSans.variable} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#09090b" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <SplashScreen />
            {children}
            <Toaster position="top-right" richColors />
            <UploadPanel />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
