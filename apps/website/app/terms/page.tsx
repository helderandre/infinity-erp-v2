import type { Metadata } from "next";
import { TermsPage } from "@/app/pages/TermsPage";

export const metadata: Metadata = {
  title: "Termos e Condições",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return <TermsPage />;
}
