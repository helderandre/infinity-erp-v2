import type { Metadata } from "next";
import { AboutPage } from "@/app/pages/AboutPage";

export const metadata: Metadata = {
  title: "Sobre Nós",
  alternates: { canonical: "/about" },
};

export default function Page() {
  return <AboutPage />;
}
