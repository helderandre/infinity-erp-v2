'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminAreaAutocomplete } from './admin-area-autocomplete'
import { DrawPolygonMap } from './draw-polygon-map'
import { adminAreaLabel } from '@/lib/matching'
import type { AdminAreaSearchResult, NegocioZone } from '@/lib/matching'

interface ZonasSheetProps {
  open: boolean
  onClose: () => void
  /** Adiciona uma nova zona à lista do negócio. Pode ser chamado várias vezes (admin) sem fechar o sheet. */
  onAdd: (zone: NegocioZone) => void
  /** IDs já seleccionados para escondê-los do autocomplete */
  excludeAdminIds?: string[]
}

export function ZonasSheet({ open, onClose, onAdd, excludeAdminIds = [] }: ZonasSheetProps) {
  const [tab, setTab] = useState<'admin' | 'draw'>('admin')

  const handleAdminSelect = (r: AdminAreaSearchResult) => {
    onAdd({
      kind: 'admin',
      area_id: r.id,
      label: adminAreaLabel(r),
    })
    // Sheet fica aberto para múltiplas selecções consecutivas
  }

  const handlePolygonComplete = (poly: { label: string; coordinates: number[][][] }) => {
    onAdd({
      kind: 'polygon',
      id: crypto.randomUUID(),
      label: poly.label,
      geometry: { type: 'Polygon', coordinates: poly.coordinates },
    })
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto p-0"
      >
        <SheetHeader className="p-6 pb-3">
          <SheetTitle>Adicionar zona de interesse</SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'admin' | 'draw')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="admin">Por zona administrativa</TabsTrigger>
              <TabsTrigger value="draw">Desenhar no mapa</TabsTrigger>
            </TabsList>
            <TabsContent value="admin" className="mt-4 space-y-3">
              <AdminAreaAutocomplete
                onSelect={handleAdminSelect}
                excludeIds={excludeAdminIds}
                placeholder="Distrito, concelho ou freguesia..."
              />
              <p className="text-xs text-muted-foreground">
                Selecciona uma zona para a adicionar. Podes adicionar várias antes de fechar.
              </p>
            </TabsContent>
            <TabsContent value="draw" className="mt-4">
              <DrawPolygonMap onComplete={handlePolygonComplete} onCancel={onClose} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
