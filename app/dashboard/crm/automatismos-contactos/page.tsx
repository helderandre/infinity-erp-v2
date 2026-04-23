import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/auth/permissions"
import { AutomationsHub } from "@/components/crm/automations-hub/automations-hub"

export const dynamic = "force-dynamic"

export default async function AutomationsHubPage() {
  const auth = await requirePermission("leads")
  if (!auth.authorized) {
    redirect("/dashboard")
  }

  const isBroker = auth.roles.some((r) => ["admin", "Broker/CEO"].includes(r))
  // Utilizadores com mais de uma role podem ver todos os leads (com filtro)
  const canSeeAll = isBroker || auth.roles.length > 1

  return (
    <div className="p-3 sm:p-6">
      <AutomationsHub userId={auth.user.id} isBroker={isBroker} canSeeAll={canSeeAll} />
    </div>
  )
}
