'use client'

import { MapaGestaoTab } from '@/components/financial/mapa-gestao-tab'
import { MapaGestaoTabs } from '@/components/financial/mapa-gestao-tabs'

export default function MapaGestaoPage() {
  return (
    <div className="space-y-4">
      <MapaGestaoTabs active="mapa" />
      <MapaGestaoTab />
    </div>
  )
}
