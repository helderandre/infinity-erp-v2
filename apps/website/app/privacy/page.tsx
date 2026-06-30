import type { Metadata } from "next";
import { PrivacyPolicyPage } from "@/app/pages/PrivacyPolicyPage";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return <PrivacyPolicyPage />;
}
