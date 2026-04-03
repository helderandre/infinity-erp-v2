'use client'

import { KitConsultorTab } from '@/components/marketing/kit-consultor-tab'

export default function KitConsultorPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kit Consultor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerir os materiais de marketing personalizados para cada consultor
        </p>
      </div>

      <KitConsultorTab />
    </div>
  )
}
