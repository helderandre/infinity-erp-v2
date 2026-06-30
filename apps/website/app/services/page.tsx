import type { Metadata } from "next";
import { ServicesPage } from "@/app/pages/ServicesPage";

export const metadata: Metadata = {
  title: "Serviços",
  alternates: { canonical: "/services" },
};

export default function Page() {
  return <ServicesPage />;
}
