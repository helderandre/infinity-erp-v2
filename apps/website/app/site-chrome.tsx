"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/app/components/Header";
import { Footer } from "@/app/components/Footer";
import { ScrollToTop } from "@/app/components/ScrollToTop";
import { CookieConsentBanner } from "@/app/components/CookieConsentBanner";

// Mirrors the original Vite App.tsx shell: conditional full-screen handling and
// hidden Footer on the property map route, plus the stale scroll-lock safety net.
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMapPage = pathname === "/property/map";

  useEffect(() => {
    if (document.body.style.position === "fixed") {
      const scrollY = document.body.style.top;
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, Math.abs(parseInt(scrollY || "0", 10)));
    }
  }, [pathname]);

  return (
    <div
      className={`min-h-screen bg-white dark:bg-gray-900 flex flex-col transition-colors duration-300 ${
        isMapPage ? "h-screen overflow-hidden" : ""
      }`}
    >
      <ScrollToTop />
      <Header />
      <main className={`flex-1 ${isMapPage ? "flex flex-col overflow-hidden" : ""}`}>
        {/* Single ancestor Suspense boundary so any page's useSearchParams()
            satisfies Next's CSR bailout requirement during prerender. */}
        <Suspense fallback={null}>{children}</Suspense>
      </main>
      {!isMapPage && <Footer />}
      <CookieConsentBanner />
    </div>
  );
}
