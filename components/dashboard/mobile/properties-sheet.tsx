'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format, isToday, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ArrowRight, Home, Sparkles, Hash, Calendar, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { PropertyPreviewSheet } from './property-preview-sheet'

interface PropertiesSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PropertyItem {
  id: string
  external_ref: string | null
  title: string | null
  listing_price: number | null
  city: string | null
  status: string | null
  created_at: string
  consultant?: { id: string; commercial_name: string } | null
  dev_property_media?: Array<{ id: string; url: string; is_cover: boolean; order_index: number }>
}

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

export function PropertiesSheet({ open, onOpenChange }: PropertiesSheetProps) {
  const isMobile = useIsMobile()
  const [items, setItems] = useState<PropertyItem[]>([])
  const [loading, setLoading] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetch('/api/properties?per_page=20&sort_by=created_at&sort_dir=desc')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        if (cancelled) return
        const data = Array.isArray(json) ? json : json.data ?? []
        setItems(data)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[75dvh] data-[side=bottom]:max-h-[75dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[520px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        )}
        <SheetHeader className="shrink-0 px-6 pt-8 pb-4 gap-0 flex-row items-center justify-between">
          <div>
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight">
              Imóveis recentes
            </SheetTitle>
            <SheetDescription className="sr-only">
              Lista dos imóveis mais recentes
            </SheetDescription>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5"
          >
            <Link href="/dashboard/imoveis" onClick={() => onOpenChange(false)}>
              Ver todos
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
              <Home className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Sem imóveis recentes</p>
            </div>
          ) : (
            items.map((p) => (
              <PropertyRow
                key={p.id}
                property={p}
                onSelect={() => setPreviewId(p.id)}
              />
            ))
          )}
        </div>
      </SheetContent>
      <PropertyPreviewSheet
        propertyId={previewId}
        open={previewId !== null}
        onOpenChange={(o) => !o && setPreviewId(null)}
      />
    </Sheet>
  )
}

function PropertyRow({
  property,
  onSelect,
}: {
  property: PropertyItem
  onSelect: () => void
}) {
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

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left flex items-center gap-4 rounded-2xl p-3 transition-colors border shadow-sm',
        isNewToday
          ? 'border-amber-400/70 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/20'
          : 'border-border/40 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/80',
      )}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
        {cover?.url ? (
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
            <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
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
        </div>
        <p className="text-sm font-semibold leading-tight truncate">
          {property.title || 'Sem título'}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {property.city && <span className="truncate">{property.city}</span>}
          {property.city && property.listing_price && (
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
          {property.consultant?.commercial_name && (
            <span className="inline-flex items-center gap-1 truncate">
              <User className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{property.consultant.commercial_name}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
