'use client'

/**
 * Read-only property sheet for the Parceiros portal. Opened from the imóvel
 * card in a campaign-request detail.
 *
 * Mounts the SAME <PropertyApresentacaoTab> a colleague consultor sees in the
 * main app's Imóveis section (a non-owner consultant only ever gets the
 * "Apresentação" tab), so the partner gets identical design + info. Data comes
 * from the partner-scoped endpoint /api/parceiros/properties/[id] (proxied to
 * the ERP), which omits dev_property_internal — so commission / internal notes
 * never reach the partner.
 */

import { useEffect, useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { PropertyApresentacaoTab } from '@/components/properties/property-apresentacao-tab'
import type { PropertyDetail } from '@/types/property'
import { Loader2, ImageOff } from 'lucide-react'

export function PartnerPropertySheet({
  propertyId,
  onOpenChange,
}: {
  propertyId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setProperty(null)
    fetch(`/api/parceiros/properties/${propertyId}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Imóvel não disponível.' : 'Erro ao carregar o imóvel.')
        return r.json()
      })
      .then((d: PropertyDetail) => { if (!cancelled) setProperty(d) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Erro') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [propertyId])

  return (
    <Sheet open={!!propertyId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-4 sm:max-w-4xl sm:p-6">
        <SheetHeader className="sr-only">
          <SheetTitle>Imóvel</SheetTitle>
          <SheetDescription>Detalhe do imóvel associado à campanha</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center">
            <ImageOff className="h-8 w-8 text-neutral-300" />
            <p className="text-sm text-neutral-500">{error}</p>
          </div>
        ) : property ? (
          <PropertyApresentacaoTab property={property} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
