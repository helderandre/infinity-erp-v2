'use client'

import type { ReactNode } from 'react'
import { format, isToday, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Home, Sparkles, Hash, Calendar, User } from 'lucide-react'
import { PROPERTY_TYPES, BUSINESS_TYPES, PROPERTY_STATUS } from '@/lib/constants'
import { cn } from '@/lib/utils'

export interface PropertyListItemData {
  id: string
  slug?: string | null
  external_ref: string | null
  title: string | null
  listing_price: number | null
  city: string | null
  created_at: string
  status?: string | null
  property_type?: string | null
  business_type?: string | null
  consultant?: { id: string; commercial_name: string } | null
  dev_property_media?: Array<{ id: string; url: string; is_cover: boolean; order_index: number }>
}

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

interface PropertyListItemProps {
  property: PropertyListItemData
  onSelect: () => void
  showConsultant?: boolean
  showStatus?: boolean
  actions?: ReactNode
}

export function PropertyListItem({
  property,
  onSelect,
  showConsultant = true,
  showStatus = false,
  actions,
}: PropertyListItemProps) {
  const cover =
    property.dev_property_media?.find((m) => m.is_cover) ||
    property.dev_property_media?.[0]

  let publishedDate: Date | null = null
  try {
    publishedDate = property.created_at ? parseISO(property.created_at) : null
  } catch {
    publishedDate = null
  }
  const isNewToday = publishedDate ? isToday(publishedDate) : false

  const typeLabel =
    PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES] ||
    property.property_type ||
    null
  const businessLabel = property.business_type
    ? BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES] || property.business_type
    : null
  const statusMeta = property.status
    ? PROPERTY_STATUS[property.status as keyof typeof PROPERTY_STATUS]
    : null

  return (
    <div
      className={cn(
        'group relative w-full rounded-2xl border transition-colors',
        isNewToday
          ? 'border-slate-300/70 dark:border-slate-400/30 bg-gradient-to-br from-white via-slate-50/80 to-white dark:from-slate-800/40 dark:via-slate-900/60 dark:to-slate-800/40 shadow-[0_0_0_1px_rgba(203,213,225,0.45),0_0_22px_-4px_rgba(148,163,184,0.55)] dark:shadow-[0_0_0_1px_rgba(148,163,184,0.25),0_0_22px_-4px_rgba(226,232,240,0.25)] hover:shadow-[0_0_0_1px_rgba(148,163,184,0.55),0_0_26px_-4px_rgba(148,163,184,0.7)]'
          : 'border-border/40 bg-white dark:bg-neutral-900 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/80',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left flex items-center gap-4 p-3"
      >
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
          {cover?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.url}
              alt={property.title || ''}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Home className="h-6 w-6 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isNewToday && (
              <span className="inline-flex items-center gap-1 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-500 dark:via-slate-300 dark:to-slate-500 text-slate-800 dark:text-slate-900 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(203,213,225,0.8)] ring-1 ring-slate-200/80 dark:ring-slate-300/50">
                <Sparkles className="h-2.5 w-2.5" />
                Novo hoje
              </span>
            )}
            {property.external_ref && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                <Hash className="h-2.5 w-2.5" />
                {property.external_ref}
              </span>
            )}
            {businessLabel && (
              <span
                className={cn(
                  'inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                  property.business_type === 'venda'
                    ? 'bg-blue-500/15 text-blue-700 border-blue-400/30 dark:text-blue-300'
                    : property.business_type === 'arrendamento'
                      ? 'bg-amber-500/15 text-amber-700 border-amber-400/30 dark:text-amber-300'
                      : 'bg-muted text-muted-foreground border-border',
                )}
              >
                {businessLabel}
              </span>
            )}
            {showStatus && statusMeta && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                  statusMeta.bg,
                  statusMeta.text,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', statusMeta.dot)} />
                {statusMeta.label}
              </span>
            )}
          </div>
          <p className={cn('text-sm font-semibold leading-tight truncate', actions ? 'pr-8' : '')}>
            {property.title || 'Sem título'}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {typeLabel && <span className="truncate">{typeLabel}</span>}
            {typeLabel && property.city && <span className="text-muted-foreground/40">·</span>}
            {property.city && <span className="truncate">{property.city}</span>}
            {(typeLabel || property.city) && property.listing_price && (
              <span className="text-muted-foreground/40">·</span>
            )}
            {property.listing_price && (
              <span className="tabular-nums font-semibold text-foreground">
                {fmt.format(property.listing_price)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
            {publishedDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5" />
                {format(publishedDate, "d 'de' MMM yyyy", { locale: pt })}
              </span>
            )}
            {showConsultant && property.consultant?.commercial_name && (
              <span className="inline-flex items-center gap-1 truncate">
                <User className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{property.consultant.commercial_name}</span>
              </span>
            )}
          </div>
        </div>
      </button>

      {actions && (
        <div className="absolute top-2.5 right-2.5 opacity-60 group-hover:opacity-100 transition-opacity">
          {actions}
        </div>
      )}
    </div>
  )
}
