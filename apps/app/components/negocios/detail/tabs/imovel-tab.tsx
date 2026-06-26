'use client'

import { Building2, MapPin, ExternalLink, Euro, Home, CalendarDays, Briefcase } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useProperty } from '@/hooks/use-property'
import { PropertyApresentacaoTab } from '@/components/properties/property-apresentacao-tab'
import type { NegocioBundle } from '@/hooks/use-deal-bundle'

interface ImovelTabProps {
  deal: NegocioBundle['deal']
  property: NegocioBundle['property']
}

const fmtMoney = (n: number | null | undefined) =>
  n == null ? null : new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n)

/**
 * Imóvel tab — first tab of the rich deal view. Shows the property this deal is
 * about:
 *   • Internal property (deal.property_id) → full presentation (gallery, specs,
 *     map) via the reused `<PropertyApresentacaoTab>`.
 *   • External property (angariacao_externa) → compact info card with the
 *     external fields the deal already carries + "Externo" badge.
 */
export function ImovelTab({ deal, property }: ImovelTabProps) {
  const propertyId = property?.id ?? deal?.property_id ?? null

  // ── Internal property: reuse the full imóvel presentation ──
  if (propertyId) {
    return <InternalProperty propertyId={propertyId} />
  }

  // ── External / no property: compact card ──
  const hasExternal =
    !!deal?.external_property_link ||
    !!deal?.external_property_typology ||
    !!deal?.external_property_zone ||
    !!deal?.external_property_type

  if (!hasExternal) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-8 flex items-start gap-3 animate-in fade-in duration-200">
        <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">Sem imóvel associado</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Este negócio ainda não tem um imóvel interno nem dados de imóvel externo. Edita o negócio
            para associar um imóvel.
          </p>
        </div>
      </div>
    )
  }

  const value = fmtMoney(deal?.deal_value)

  return (
    <div className="animate-in fade-in duration-200">
      <div className="rounded-2xl border bg-card p-5 sm:p-6 max-w-2xl">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Briefcase className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold tracking-tight">
                {deal?.external_property_typology
                  ? `${deal.external_property_typology}${deal.external_property_type ? ` · ${deal.external_property_type}` : ''}`
                  : (deal?.external_property_type ?? 'Imóvel externo')}
              </h3>
              <Badge
                variant="outline"
                className="rounded-full text-[10px] border-amber-500/30 text-amber-700 bg-amber-500/10 dark:text-amber-300"
              >
                Externo
              </Badge>
            </div>
            {deal?.external_property_zone && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {deal.external_property_zone}
              </p>
            )}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {deal?.external_property_type && (
            <Field icon={Home} label="Tipo" value={deal.external_property_type} />
          )}
          {deal?.external_property_typology && (
            <Field icon={Building2} label="Tipologia" value={deal.external_property_typology} />
          )}
          {deal?.external_property_construction_year && (
            <Field icon={CalendarDays} label="Ano de construção" value={deal.external_property_construction_year} />
          )}
          {value && <Field icon={Euro} label="Valor do negócio" value={value} />}
        </dl>

        {deal?.external_property_extra && (
          <p className="mt-4 text-sm text-muted-foreground whitespace-pre-line">
            {deal.external_property_extra}
          </p>
        )}

        {deal?.external_property_link && (
          <Button asChild variant="outline" size="sm" className="mt-5 rounded-full gap-1.5">
            <a href={deal.external_property_link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir anúncio
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}

function Field({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className="mt-0.5 font-medium truncate">{value}</dd>
    </div>
  )
}

function InternalProperty({ propertyId }: { propertyId: string }) {
  const { property, isLoading, error } = useProperty(propertyId)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-in fade-in duration-200">
        <Skeleton className="h-[420px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 p-8 flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">Não foi possível carregar o imóvel</p>
          <p className="text-xs text-muted-foreground mt-0.5">{error ?? 'Imóvel não encontrado.'}</p>
        </div>
      </div>
    )
  }

  return <PropertyApresentacaoTab property={property} />
}
