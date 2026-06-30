import type { Metadata } from "next";
import { LegalNoticePage } from "@/app/pages/LegalNoticePage";

export const metadata: Metadata = {
  title: "Aviso Legal",
  alternates: { canonical: "/legal" },
};

export default function Page() {
  return <LegalNoticePage />;
}
