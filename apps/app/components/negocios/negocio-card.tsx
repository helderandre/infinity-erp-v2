'use client'

import Image from 'next/image'
import { Briefcase, Users, Calendar, Euro } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NegocioCardData {
  id: string
  reference: string | null
  pv_number?: string | null
  property_title: string | null
  external_property_link: string | null
  deal_type: string
  status: string
  deal_value: number | null
  commission_total: number | null
  deal_date: string | null
  consultant_name: string | null
}

interface NegocioCardProps {
  deal: NegocioCardData
  thumbnailUrl: string | null
  scenarioInfo: { label: string } | undefined
  scenarioColor: string
  statusInfo: { label: string; color: string } | undefined
  statusDot: string
  onClick: () => void
}

const fmtCurrency = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export function NegocioCard({
  deal,
  thumbnailUrl,
  scenarioInfo,
  scenarioColor,
  statusInfo,
  statusDot,
  onClick,
}: NegocioCardProps) {
  const ref = deal.reference || deal.pv_number || deal.id.slice(0, 8)
  const propertyLabel = deal.property_title || (deal.external_property_link ? 'Imóvel externo' : 'Sem imóvel')

  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-2xl border border-border/40 bg-card overflow-hidden cursor-pointer transition-all',
        'hover:shadow-lg hover:border-border/80 hover:-translate-y-0.5',
      )}
    >
      {/* Hero image / logo placeholder */}
      <div className="relative aspect-[16/10] bg-muted/30 overflow-hidden">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
            <div className="relative h-16 w-16 opacity-50 transition-opacity group-hover:opacity-70">
              <Image
                src="/icon-512.png"
                alt="Infinity Group"
                fill
                className="object-contain"
                sizes="64px"
              />
            </div>
          </div>
        )}

        {/* Scenario badge — top right */}
        <span
          className={cn(
            'absolute top-2.5 right-2.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap border backdrop-blur-sm bg-background/80',
            scenarioColor,
          )}
        >
          {scenarioInfo?.label ?? deal.deal_type}
        </span>

        {/* External marker */}
        {deal.external_property_link && !thumbnailUrl && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/90 text-white backdrop-blur-sm">
            <Briefcase className="h-2.5 w-2.5" />
            Externo
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-2.5">
        <div className="space-y-0.5">
          <p className="font-mono text-[10px] text-muted-foreground tracking-wide truncate">{ref}</p>
          <p className="font-semibold text-sm leading-tight line-clamp-2">{propertyLabel}</p>
        </div>

        {/* Status + consultant pills */}
        <div className="flex flex-wrap gap-1.5 min-h-[20px]">
          {statusInfo && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium',
                statusInfo.color,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', statusDot)} />
              {statusInfo.label}
            </span>
          )}
          {deal.consultant_name && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2 py-0.5 rounded-full text-muted-foreground">
              <Users className="h-2.5 w-2.5" />
              <span className="truncate max-w-[100px]">{deal.consultant_name}</span>
            </span>
          )}
        </div>

        {/* Footer: value + date */}
        <div className="flex items-end justify-between pt-2 border-t border-border/40">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Euro className="h-2.5 w-2.5" />
              Valor
            </p>
            <p className="font-semibold text-sm">{fmtCurrency(deal.deal_value)}</p>
            {deal.commission_total != null && (
              <p className="text-[10px] text-muted-foreground">
                Comissão {fmtCurrency(deal.commission_total)}
              </p>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="h-2.5 w-2.5" />
            {fmtDate(deal.deal_date)}
          </p>
        </div>
      </div>
    </div>
  )
}
