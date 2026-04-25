'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X, MapPin, Pencil, Building2, Map as MapIcon } from 'lucide-react'
import { ZonasSheet } from './zonas-sheet'
import type { NegocioZone } from '@/lib/matching'

interface NegocioZonasFieldProps {
  value: NegocioZone[]
  onChange: (zonas: NegocioZone[]) => void
  /** Contador live, ex.: "12 imóveis" — opcional. */
  matchCountLabel?: string | null
}

export function NegocioZonasField({ value, onChange, matchCountLabel }: NegocioZonasFieldProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const excludeAdminIds = useMemo(
    () => value.filter((z) => z.kind === 'admin').map((z) => z.area_id),
    [value]
  )

  const handleAdd = (zone: NegocioZone) => {
    // Evita duplicados de admin
    if (zone.kind === 'admin' && excludeAdminIds.includes(zone.area_id)) return
    onChange([...value, zone])
  }

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Zonas de interesse</p>
          {matchCountLabel && (
            <p className="text-xs text-muted-foreground">{matchCountLabel}</p>
          )}
        </div>

        {value.length === 0 ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="w-full rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar zona (concelho, freguesia ou desenho)
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {value.map((zone, i) => {
                const Icon =
                  zone.kind === 'polygon'
                    ? Pencil
                    : (zone as { kind: 'admin' }).kind === 'admin'
                      ? guessIconFromLabel(zone.label)
                      : MapPin
                return (
                  <span
                    key={zone.kind === 'polygon' ? zone.id : `admin-${zone.area_id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 border border-border/40 px-2.5 py-1 text-xs"
                  >
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{zone.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(i)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/15 p-0.5"
                      aria-label={`Remover ${zone.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSheetOpen(true)}
              className="h-8"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adicionar zona
            </Button>
          </div>
        )}
      </div>

      <ZonasSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={handleAdd}
        excludeAdminIds={excludeAdminIds}
      />
    </>
  )
}

function guessIconFromLabel(label: string): React.ElementType {
  if (label.includes('Distrito')) return MapIcon
  if (label.includes('Concelho')) return Building2
  return MapPin
}
