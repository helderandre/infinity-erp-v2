import type { Metadata } from "next";
import { CookiePolicyPage } from "@/app/pages/CookiePolicyPage";

export const metadata: Metadata = {
  title: "Política de Cookies",
  alternates: { canonical: "/cookies" },
};

export default function Page() {
  return <CookiePolicyPage />;
}
