'use client'

import { MapaGestaoTab } from '@/components/financial/mapa-gestao-tab'
import { EmpresaTabsNav } from '@/components/financial/empresa-tabs-nav'

export default function MapaGestaoPage() {
  return (
    <div className="space-y-4">
      <EmpresaTabsNav active="mapa" />
      <MapaGestaoTab />
    </div>
  )
}
