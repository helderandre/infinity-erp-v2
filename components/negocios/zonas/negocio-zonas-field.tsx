'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X, MapPin, Pencil, Building2, Map as MapIcon } from 'lucide-react'
import { ZonasMapPicker } from './zonas-map-picker'
import { AdminAreaAutocomplete } from './admin-area-autocomplete'
import { adminAreaLabel } from '@/lib/matching'
import type { NegocioZone } from '@/lib/matching'

interface NegocioZonasFieldProps {
  value: NegocioZone[]
  onChange: (zonas: NegocioZone[]) => void
  /**
   * Quando presente, abre o `<ZonasMapPicker>` em ecrã cheio com mapa +
   * lista de imóveis. Quando ausente (ex.: criação dum negócio antes de
   * persistir), o campo mostra um autocomplete inline (sem novo sheet).
   */
  negocioId?: string
  /**
   * Texto de localização ainda não persistido — propagado ao picker
   * para o ramo de texto contar imediatamente, mesmo antes de guardar.
   */
  localizacao?: string | null
  /**
   * Perspectiva do negócio — controla o label do campo:
   *   • Comprador / Arrendatário → "Zonas de interesse" (onde quer comprar/arrendar)
   *   • Vendedor / Senhorio       → "Localização do imóvel" (onde fica o imóvel)
   * Quando ausente cai no default "Zonas de interesse".
   */
  tipo?: string | null
}

function resolveLabel(tipo: string | null | undefined): string {
  if (tipo === 'Vendedor' || tipo === 'Senhorio' || tipo === 'Arrendador' || tipo === 'Venda') {
    return 'Localização do imóvel'
  }
  return 'Zonas de interesse'
}

export function NegocioZonasField({ value, onChange, negocioId, localizacao, tipo }: NegocioZonasFieldProps) {
  const fieldLabel = resolveLabel(tipo)
  const [pickerOpen, setPickerOpen] = useState(false)

  const excludeAdminIds = useMemo(
    () => value.filter((z) => z.kind === 'admin').map((z) => z.area_id),
    [value]
  )

  const handleAdd = (zone: NegocioZone) => {
    if (zone.kind === 'admin' && excludeAdminIds.includes(zone.area_id)) return
    onChange([...value, zone])
  }

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const Chips = (
    <div className="flex flex-wrap gap-1.5">
      {value.map((zone, i) => {
        const Icon =
          zone.kind === 'polygon'
            ? Pencil
            : zone.label.includes('Distrito')
              ? MapIcon
              : zone.label.includes('Concelho')
                ? Building2
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
  )

  // Modo inline: criação dum negócio (sem id ainda) — autocomplete sempre
  // visível, chips por cima. Não abre sheet nenhum. Para vendedor/senhorio
  // (perspectiva de listing) o imóvel é único — esconder o autocomplete
  // assim que houver uma zona seleccionada para evitar lista de várias.
  const isSellerSide = tipo === 'Vendedor' || tipo === 'Senhorio' || tipo === 'Arrendador' || tipo === 'Venda'
  const hideAutocomplete = isSellerSide && value.length >= 1

  if (!negocioId) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{fieldLabel}</p>
        {value.length > 0 && Chips}
        {!hideAutocomplete && (
          <AdminAreaAutocomplete
            onSelect={(r) =>
              handleAdd({ kind: 'admin', area_id: r.id, label: adminAreaLabel(r) })
            }
            excludeIds={excludeAdminIds}
            placeholder={isSellerSide ? 'Procurar concelho, freguesia ou distrito...' : 'Adicionar concelho, freguesia ou distrito...'}
          />
        )}
      </div>
    )
  }

  // Modo full-picker: negócio já persistido — abre `<ZonasMapPicker>` com
  // mapa + lista de imóveis matched.
  return (
    <>
      <div className="space-y-2">
        <p className="text-sm font-medium">{fieldLabel}</p>

        {value.length === 0 ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Escolher zonas no mapa
          </button>
        ) : (
          <div className="space-y-2">
            {Chips}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
              className="h-8"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Editar zonas no mapa
            </Button>
          </div>
        )}
      </div>

      <ZonasMapPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSave={(zones) => onChange(zones)}
        initialZones={value}
        negocioId={negocioId}
        localizacaoOverride={localizacao ?? null}
      />
    </>
  )
}
