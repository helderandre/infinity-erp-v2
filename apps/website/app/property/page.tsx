import type { Metadata } from "next";
import { PropertyPage } from "@/app/pages/PropertyPage";

export const metadata: Metadata = {
  title: "Imóveis",
  description:
    "Explore os imóveis disponíveis da Infinity Group — apartamentos, moradias e mais, para compra e arrendamento em Portugal.",
  alternates: { canonical: "/property" },
};

export default function Page() {
  return <PropertyPage />;
}
