import { redirect } from "next/navigation"

export default function FluxosRedirectPage() {
  redirect("/dashboard/automacao?tab=fluxos")
}
