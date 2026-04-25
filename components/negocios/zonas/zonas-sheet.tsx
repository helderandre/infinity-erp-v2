'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
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

const TABS = [
  { value: 'admin' as const, label: 'Por zona' },
  { value: 'draw' as const, label: 'Desenhar' },
]

export function ZonasSheet({ open, onClose, onAdd, excludeAdminIds = [] }: ZonasSheetProps) {
  const isMobile = useIsMobile()
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
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}

        {/* Header */}
        <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
          <SheetHeader className="p-0 gap-0">
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
              Adicionar zona de interesse
            </SheetTitle>
            <SheetDescription className="sr-only">
              Pesquise um distrito, concelho ou freguesia, ou desenhe a zona no mapa.
            </SheetDescription>
          </SheetHeader>

          {/* Pill-tab segmented control */}
          <div className="mt-4">
            <div
              role="tablist"
              className="flex w-fit p-0.5 rounded-full bg-muted/60 border border-border/30"
            >
              {TABS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === opt.value}
                  className={cn(
                    'px-4 py-1 rounded-full text-xs font-medium transition-all',
                    tab === opt.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setTab(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          {tab === 'admin' ? (
            <div className="space-y-3">
              <AdminAreaAutocomplete
                onSelect={handleAdminSelect}
                excludeIds={excludeAdminIds}
                placeholder="Distrito, concelho ou freguesia..."
              />
              <p className="text-xs text-muted-foreground">
                Selecciona uma zona para a adicionar. Podes adicionar várias antes de fechar.
              </p>
            </div>
          ) : (
            <DrawPolygonMap onComplete={handlePolygonComplete} onCancel={onClose} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
