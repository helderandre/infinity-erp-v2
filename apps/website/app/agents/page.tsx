import type { Metadata } from "next";
import { AgentsPage } from "@/app/pages/AgentsPage";

export const metadata: Metadata = {
  title: "Equipa",
  alternates: { canonical: "/agents" },
};

export default function Page() {
  return <AgentsPage />;
}
