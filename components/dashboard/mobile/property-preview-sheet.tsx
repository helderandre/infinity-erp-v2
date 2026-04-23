'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  BedDouble,
  Bath,
  Ruler,
  MapPin,
  Hash,
  ArrowRight,
  Home,
  User,
  Calendar,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

interface PropertyPreviewSheetProps {
  propertyId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PropertyDetail {
  id: string
  slug: string | null
  title: string | null
  description: string | null
  listing_price: number | null
  property_type: string | null
  business_type: string | null
  external_ref: string | null
  energy_certificate: string | null
  address_street: string | null
  city: string | null
  zone: string | null
  created_at: string
  dev_property_specifications?: {
    typology: string | null
    bedrooms: number | null
    bathrooms: number | null
    area_util: number | null
    area_gross: number | null
  } | null
  dev_property_media?: Array<{
    id: string
    url: string
    is_cover: boolean
    order_index: number
  }>
  consultant?: { id: string; commercial_name: string } | null
}

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

export function PropertyPreviewSheet({
  propertyId,
  open,
  onOpenChange,
}: PropertyPreviewSheetProps) {
  const isMobile = useIsMobile()
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !propertyId) {
      setProperty(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/properties/${propertyId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setProperty(data)
      })
      .catch(() => {
        if (!cancelled) setProperty(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, propertyId])

  const spec = property?.dev_property_specifications
  const cover =
    property?.dev_property_media?.find((m) => m.is_cover) ||
    property?.dev_property_media?.[0]
  const publishedDate = property?.created_at
    ? (() => {
        try {
          return parseISO(property.created_at)
        } catch {
          return null
        }
      })()
    : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[480px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="sr-only">
          <SheetTitle>{property?.title || 'Pré-visualização do imóvel'}</SheetTitle>
          <SheetDescription>Pré-visualização do imóvel</SheetDescription>
        </SheetHeader>

        {loading || !property ? (
          <PreviewSkeleton />
        ) : (
          <>
            {/* Cover */}
            <div className="relative h-56 w-full shrink-0 bg-muted">
              {cover?.url ? (
                <img
                  src={cover.url}
                  alt={property.title || ''}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Home className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
              {property.external_ref && (
                <span className="absolute top-4 left-4 inline-flex items-center gap-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-medium px-2.5 py-1 rounded-full border border-white/20">
                  <Hash className="h-2.5 w-2.5" />
                  {property.external_ref}
                </span>
              )}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
              {/* Title + price */}
              <div>
                <h2 className="text-[20px] font-semibold leading-tight tracking-tight">
                  {property.title || 'Sem título'}
                </h2>
                {(property.city || property.address_street) && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {[property.address_street, property.zone, property.city]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </p>
                )}
                {property.listing_price && (
                  <p className="mt-3 text-2xl font-bold tabular-nums">
                    {fmt.format(property.listing_price)}
                  </p>
                )}
              </div>

              {/* Quick spec tiles */}
              {spec && (
                <div className="grid grid-cols-4 gap-2">
                  {spec.typology && (
                    <SpecTile icon={Home} label="Tipologia" value={spec.typology} />
                  )}
                  {spec.bedrooms != null && (
                    <SpecTile
                      icon={BedDouble}
                      label="Quartos"
                      value={String(spec.bedrooms)}
                    />
                  )}
                  {spec.bathrooms != null && (
                    <SpecTile
                      icon={Bath}
                      label="WCs"
                      value={String(spec.bathrooms)}
                    />
                  )}
                  {spec.area_util != null && (
                    <SpecTile
                      icon={Ruler}
                      label="Área útil"
                      value={`${spec.area_util}m²`}
                    />
                  )}
                </div>
              )}

              {/* Description excerpt */}
              {property.description && (
                <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Descrição
                  </p>
                  <p className="text-sm leading-relaxed line-clamp-5">
                    {property.description}
                  </p>
                </div>
              )}

              {/* Meta info */}
              <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                {property.consultant?.commercial_name && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      Consultor: {property.consultant.commercial_name}
                    </span>
                  </div>
                )}
                {publishedDate && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>
                      Publicado em{' '}
                      {format(publishedDate, "d 'de' MMM yyyy", { locale: pt })}
                    </span>
                  </div>
                )}
                {property.energy_certificate && (
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3 w-3 shrink-0" />
                    <span>
                      Certificado energético: {property.energy_certificate}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer action */}
            <div className="shrink-0 px-6 py-4 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md">
              <Button
                asChild
                className="w-full gap-2 rounded-full"
                size="lg"
              >
                <Link
                  href={`/dashboard/imoveis/${property.id}`}
                  onClick={() => onOpenChange(false)}
                >
                  Ver imóvel completo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function SpecTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/60 px-2 py-2.5 text-center">
      <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
      <p className="text-sm font-semibold tabular-nums leading-none truncate">
        {value}
      </p>
      <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider truncate">
        {label}
      </p>
    </div>
  )
}

function PreviewSkeleton() {
  return (
    <>
      <Skeleton className="h-56 w-full shrink-0 rounded-none" />
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-1/3 mt-3" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
      <div className="shrink-0 px-6 py-4 border-t border-border/40">
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </>
  )
}
