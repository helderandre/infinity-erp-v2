'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { FinanceiroSheet } from '@/components/financial/sheets/financeiro-sheet'
import type { DrillDownItem } from '@/app/dashboard/drill-down-actions'

// Tone tokens — same scale used across financeiro KpiCard / DashboardKpiDrilldownSheet.
type Tone = 'positive' | 'negative' | 'warning' | 'info' | 'purple' | 'neutral'
const TONE_MAP: Record<Tone, { from: string; dot: string }> = {
  positive: { from: 'from-emerald-500/15', dot: 'bg-emerald-500' },
  negative: { from: 'from-red-500/15',     dot: 'bg-red-500' },
  warning:  { from: 'from-amber-500/15',   dot: 'bg-amber-500' },
  info:     { from: 'from-blue-500/15',    dot: 'bg-blue-500' },
  purple:   { from: 'from-purple-500/15',  dot: 'bg-purple-500' },
  neutral:  { from: 'from-slate-500/10',   dot: 'bg-slate-400' },
}

export interface MobileDrillDownConfig {
  title: string
  description?: string
  /** Visual tone for the total tile + accent dot. Defaults to 'neutral'. */
  tone?: Tone
  fetcher: () => Promise<{ items: DrillDownItem[]; error: string | null }>
}

interface MobileDrillDownSheetProps {
  config: MobileDrillDownConfig | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileDrillDownSheet({
  config,
  open,
  onOpenChange,
}: MobileDrillDownSheetProps) {
  const router = useRouter()
  const [items, setItems] = useState<DrillDownItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && config) {
      setLoading(true)
      setItems([])
      config.fetcher().then((res) => {
        if (!res.error) setItems(res.items)
        setLoading(false)
      })
    }
  }, [open, config])

  const tone = config?.tone ?? 'neutral'
  const toneTokens = TONE_MAP[tone]

  return (
    <FinanceiroSheet
      open={open}
      onOpenChange={onOpenChange}
      title={config?.title ?? ''}
      accent={
        <span className={cn('inline-flex h-2 w-2 rounded-full', toneTokens.dot)} />
      }
      subtitle={config?.description}
      size="wide"
      footer={
        <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">
          Fechar
        </Button>
      }
    >
      {/* Total / count tile — same shape as DashboardKpiDrilldownSheet.EntriesView */}
      <div
        className={cn(
          'rounded-2xl ring-1 ring-border/40 p-5 bg-gradient-to-br to-transparent',
          toneTokens.from,
        )}
      >
        <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
          Total
        </p>
        {loading ? (
          <Skeleton className="h-8 w-32 mt-2" />
        ) : (
          <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums mt-1">
            {items.length}
          </p>
        )}
        {!loading && (
          <p className="text-xs text-muted-foreground mt-2">
            {items.length === 0
              ? 'Sem registos no período.'
              : `${items.length} ${items.length === 1 ? 'resultado' : 'resultados'}`}
          </p>
        )}
      </div>

      {/* Entry list */}
      <div className="space-y-2">
        {loading && (
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl ring-1 ring-border/40 bg-background/60 py-12 text-center text-sm text-muted-foreground">
            <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Sem entradas para listar.
          </div>
        )}

        {!loading &&
          items.map((item) => (
            <EntryRow
              key={item.id}
              item={item}
              onClick={() => {
                onOpenChange(false)
                router.push(item.href)
              }}
            />
          ))}
      </div>
    </FinanceiroSheet>
  )
}

function EntryRow({
  item,
  onClick,
}: {
  item: DrillDownItem
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full text-left rounded-2xl ring-1 ring-border/40 bg-background/60 p-4',
        'transition-all cursor-pointer hover:ring-border/70 hover:shadow-[0_4px_16px_-6px_rgb(0_0_0_/_0.08)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.title}
                </p>
                {item.badge && (
                  <Badge
                    variant={item.badge.variant}
                    className="text-[10px] shrink-0 rounded-full"
                  >
                    {item.badge.label}
                  </Badge>
                )}
              </div>
              {item.subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {item.subtitle}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              {item.extra && (
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {item.extra}
                </p>
              )}
              {item.date && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {item.date}
                </p>
              )}
            </div>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-0.5" />
      </div>
    </button>
  )
}
