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
  ArrowRight,
  User,
  Calendar,
  Home,
  Thermometer,
  Handshake,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

interface NegocioPreviewSheetProps {
  negocioId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface NegocioDetail {
  id: string
  lead_id: string
  tipo: string | null
  expected_value: number | null
  probability_pct: number | null
  observacoes: string | null
  temperatura: string | null
  created_at: string
  updated_at: string
  stage_entered_at: string | null
  lead?: { id: string; nome: string | null } | null
  dev_users?: { id: string; commercial_name: string } | null
  leads_pipeline_stages?: {
    id: string
    name: string
    order_index: number
    pipeline_type: string
  } | null
  dev_properties?: {
    id: string
    title: string | null
    external_ref: string | null
    city: string | null
    listing_price: number | null
  } | null
}

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const TEMP_LABEL: Record<string, string> = {
  quente: 'Quente',
  morno: 'Morno',
  frio: 'Frio',
}

export function NegocioPreviewSheet({
  negocioId,
  open,
  onOpenChange,
}: NegocioPreviewSheetProps) {
  const isMobile = useIsMobile()
  const [negocio, setNegocio] = useState<NegocioDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !negocioId) {
      setNegocio(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/crm/negocios/${negocioId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setNegocio(data?.data ?? data ?? null)
      })
      .catch(() => {
        if (!cancelled) setNegocio(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, negocioId])

  const updatedDate = negocio?.updated_at
    ? (() => {
        try {
          return parseISO(negocio.updated_at)
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
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[480px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="sr-only">
          <SheetTitle>{negocio?.lead?.nome || 'Pré-visualização do negócio'}</SheetTitle>
          <SheetDescription>Pré-visualização do negócio</SheetDescription>
        </SheetHeader>

        {loading || !negocio ? (
          <PreviewSkeleton />
        ) : (
          <>
            <div className="px-6 pt-8 pb-4">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                Negócio
              </p>
              <h2 className="mt-0.5 text-[22px] font-semibold leading-tight tracking-tight">
                {negocio.lead?.nome || 'Sem nome'}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {negocio.tipo && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-2.5 py-1">
                    <Handshake className="h-3 w-3" />
                    {negocio.tipo}
                  </span>
                )}
                {negocio.leads_pipeline_stages?.name && (
                  <span className="inline-flex items-center rounded-full bg-muted/60 border border-border/40 text-muted-foreground text-[11px] font-medium px-2.5 py-1">
                    {negocio.leads_pipeline_stages.name}
                  </span>
                )}
                {negocio.temperatura && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border/40 text-muted-foreground text-[11px] font-medium px-2.5 py-1">
                    <Thermometer className="h-3 w-3" />
                    {TEMP_LABEL[negocio.temperatura] ?? negocio.temperatura}
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-5 space-y-4">
              {/* Value row */}
              {(negocio.expected_value || negocio.probability_pct) && (
                <div className="grid grid-cols-2 gap-2">
                  {negocio.expected_value != null && (
                    <div className="rounded-xl border border-border/40 bg-background/60 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Valor previsto
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums">
                        {fmt.format(negocio.expected_value)}
                      </p>
                    </div>
                  )}
                  {negocio.probability_pct != null && (
                    <div className="rounded-xl border border-border/40 bg-background/60 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        Probabilidade
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums">
                        {negocio.probability_pct}%
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Linked property */}
              {negocio.dev_properties && (
                <div className="rounded-2xl border border-border/40 bg-background/60 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Home className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Imóvel
                    </p>
                  </div>
                  <p className="text-sm font-medium truncate">
                    {negocio.dev_properties.title || 'Sem título'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {[
                      negocio.dev_properties.external_ref
                        ? `#${negocio.dev_properties.external_ref}`
                        : null,
                      negocio.dev_properties.city,
                      negocio.dev_properties.listing_price
                        ? fmt.format(negocio.dev_properties.listing_price)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              )}

              {/* Observações */}
              {negocio.observacoes && (
                <div className="rounded-2xl border border-border/40 bg-background/60 p-4">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Observações
                  </p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-6">
                    {negocio.observacoes}
                  </p>
                </div>
              )}

              {/* Meta */}
              <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                {negocio.dev_users?.commercial_name && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      Consultor: {negocio.dev_users.commercial_name}
                    </span>
                  </div>
                )}
                {updatedDate && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>
                      Última actualização{' '}
                      {format(updatedDate, "d 'de' MMM yyyy", { locale: pt })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md">
              <Button
                asChild
                className="w-full gap-2 rounded-full"
                size="lg"
              >
                <Link
                  href={`/dashboard/leads/${negocio.lead_id}/negocios/${negocio.id}`}
                  onClick={() => onOpenChange(false)}
                >
                  Ver negócio completo
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

function PreviewSkeleton() {
  return (
    <>
      <div className="px-6 pt-8 pb-4 space-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-6 w-3/4" />
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
      <div className="shrink-0 px-6 py-4 border-t border-border/40">
        <Skeleton className="h-11 w-full rounded-full" />
      </div>
    </>
  )
}
