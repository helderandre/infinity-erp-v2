'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { differenceInCalendarDays, isToday, parseISO } from 'date-fns'
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
  Kanban,
  Sparkles,
  AlertTriangle,
  Handshake,
  Thermometer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { NegocioPreviewSheet } from './negocio-preview-sheet'

interface PipelineSheetProps {
  userId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface NegocioItem {
  id: string
  lead_id: string
  tipo: string | null
  expected_value: number | null
  temperatura: string | null
  created_at: string
  updated_at: string
  lead?: { id: string; nome: string | null } | null
  leads_pipeline_stages?: {
    id: string
    name: string
    order_index: number
  } | null
}

const fmtCompact = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const TEMP_DOT: Record<string, string> = {
  quente: 'bg-red-500',
  morno: 'bg-amber-500',
  frio: 'bg-blue-500',
}

const STALE_DAYS = 7

type Destaque = 'new' | 'stale' | null

function getDestaque(updatedAt: string): Destaque {
  try {
    const d = parseISO(updatedAt)
    if (isToday(d)) return 'new'
    const diff = differenceInCalendarDays(new Date(), d)
    if (diff >= STALE_DAYS) return 'stale'
    return null
  } catch {
    return null
  }
}

export function PipelineSheet({
  userId,
  open,
  onOpenChange,
}: PipelineSheetProps) {
  const isMobile = useIsMobile()
  const [items, setItems] = useState<NegocioItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setSelectedStageId(null)
    fetch(
      `/api/crm/negocios?assigned_consultant_id=${userId}&per_page=100`,
    )
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        if (cancelled) return
        const data: NegocioItem[] = Array.isArray(json) ? json : json.data ?? []
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
  }, [open, userId])

  // Stage counts (my negócios grouped by stage)
  const stageChips = useMemo(() => {
    const byStage = new Map<
      string,
      { id: string; name: string; order: number; count: number }
    >()
    for (const n of items) {
      const s = n.leads_pipeline_stages
      if (!s) continue
      const prev = byStage.get(s.id)
      byStage.set(s.id, {
        id: s.id,
        name: s.name,
        order: s.order_index ?? 0,
        count: (prev?.count ?? 0) + 1,
      })
    }
    return Array.from(byStage.values()).sort((a, b) => a.order - b.order)
  }, [items])

  const filtered = useMemo(() => {
    if (!selectedStageId) return items
    return items.filter(
      (n) => n.leads_pipeline_stages?.id === selectedStageId,
    )
  }, [items, selectedStageId])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const at = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return bt - at
    })
  }, [filtered])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[520px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="shrink-0 px-6 pt-8 pb-3 gap-0 flex-row items-center justify-between">
          <div>
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight">
              Pipeline
            </SheetTitle>
            <SheetDescription className="sr-only">
              Os meus negócios
            </SheetDescription>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5"
          >
            <Link href="/dashboard/crm" onClick={() => onOpenChange(false)}>
              Ver pipeline
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </SheetHeader>

        {/* Stage chips */}
        {!loading && stageChips.length > 0 && (
          <div className="shrink-0 px-4 pb-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 w-max">
              <StageChip
                label="Todos"
                count={items.length}
                active={selectedStageId === null}
                onClick={() => setSelectedStageId(null)}
              />
              {stageChips.map((s) => (
                <StageChip
                  key={s.id}
                  label={s.name}
                  count={s.count}
                  active={selectedStageId === s.id}
                  onClick={() => setSelectedStageId(s.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 pt-2 space-y-2">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
              <Kanban className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Sem negócios</p>
            </div>
          ) : (
            sorted.map((n) => (
              <NegocioRow
                key={n.id}
                negocio={n}
                onSelect={() => setPreviewId(n.id)}
              />
            ))
          )}
        </div>
      </SheetContent>

      <NegocioPreviewSheet
        negocioId={previewId}
        open={previewId !== null}
        onOpenChange={(o) => !o && setPreviewId(null)}
      />
    </Sheet>
  )
}

function StageChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-foreground text-background border-foreground'
          : 'bg-background/60 text-foreground/80 border-border/40 hover:bg-muted/60',
      )}
    >
      <span className="truncate max-w-[9rem]">{label}</span>
      <span
        className={cn(
          'tabular-nums text-[10px] rounded-full px-1.5 py-0.5',
          active
            ? 'bg-background/20 text-background'
            : 'bg-muted/60 text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function NegocioRow({
  negocio,
  onSelect,
}: {
  negocio: NegocioItem
  onSelect: () => void
}) {
  const destaque = getDestaque(negocio.updated_at)
  const name = negocio.lead?.nome || 'Sem nome'
  const tempDot = negocio.temperatura
    ? TEMP_DOT[negocio.temperatura]
    : 'bg-muted-foreground/40'

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left flex flex-col gap-1.5 rounded-2xl p-3 transition-colors border shadow-sm',
        destaque === 'new'
          ? 'border-amber-400/70 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 dark:hover:bg-amber-500/20'
          : destaque === 'stale'
          ? 'border-red-400/60 bg-red-50/70 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/15'
          : 'border-border/40 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/80',
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {destaque === 'new' && (
          <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            <Sparkles className="h-2.5 w-2.5" />
            Actualizado hoje
          </span>
        )}
        {destaque === 'stale' && (
          <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            <AlertTriangle className="h-2.5 w-2.5" />
            Sem actividade
          </span>
        )}
        <span className={cn('h-2 w-2 rounded-full shrink-0', tempDot)} />
        <p className="text-sm font-semibold truncate flex-1 min-w-0">{name}</p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
        {negocio.tipo && (
          <span className="inline-flex items-center gap-1 text-foreground/70">
            <Handshake className="h-3 w-3" />
            {negocio.tipo}
          </span>
        )}
        {negocio.leads_pipeline_stages?.name && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="truncate">
              {negocio.leads_pipeline_stages.name}
            </span>
          </>
        )}
        {negocio.expected_value != null && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="tabular-nums font-semibold text-foreground">
              {fmtCompact.format(negocio.expected_value)}
            </span>
          </>
        )}
        {negocio.temperatura && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-0.5 capitalize">
              <Thermometer className="h-2.5 w-2.5" />
              {negocio.temperatura}
            </span>
          </>
        )}
      </div>
    </button>
  )
}
