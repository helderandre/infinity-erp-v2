import type { Metadata } from "next";
import { ContactPage } from "@/app/pages/ContactPage";

export const metadata: Metadata = {
  title: "Contactos",
  alternates: { canonical: "/contact" },
};

export default function Page() {
  return <ContactPage />;
}
