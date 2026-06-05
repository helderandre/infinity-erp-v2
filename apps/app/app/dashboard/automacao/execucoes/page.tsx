import { redirect } from "next/navigation"

export default function ExecucoesRedirectPage() {
  redirect("/dashboard/automacao?tab=execucoes")
}
