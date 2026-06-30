import type { Metadata } from "next";
import { AddPropertyPage } from "@/app/pages/AddPropertyPage";

// Internal/app-only route — kept out of the index (mirrors robots.txt Disallow).
export const metadata: Metadata = {
  title: "Adicionar Imóvel",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AddPropertyPage />;
}
