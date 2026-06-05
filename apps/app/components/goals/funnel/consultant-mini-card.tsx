'use client'

import { cn } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'
import type { TeamOverviewConsultantCard, FunnelStageStatus } from '@/types/funnel'

interface Props {
  card: TeamOverviewConsultantCard
  onClick: () => void
}

const STATUS_LABEL: Record<FunnelStageStatus, string> = {
  late: 'Atrasado',
  attention: 'Atenção',
  on_track: 'Em linha',
  completed: 'Concluído',
  pending: 'Pendente',
}

const STATUS_TEXT: Record<FunnelStageStatus, string> = {
  late: 'text-red-600',
  attention: 'text-amber-600',
  on_track: 'text-emerald-600',
  completed: 'text-emerald-600',
  pending: 'text-muted-foreground',
}

const STATUS_DOT: Record<FunnelStageStatus, string> = {
  late: 'bg-red-500',
  attention: 'bg-amber-500',
  on_track: 'bg-emerald-500',
  completed: 'bg-emerald-500',
  pending: 'bg-slate-400',
}

const STATUS_BAR: Record<FunnelStageStatus, string> = {
  late: 'bg-red-500',
  attention: 'bg-amber-500',
  on_track: 'bg-emerald-500',
  completed: 'bg-emerald-500',
  pending: 'bg-slate-300',
}

const eurFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('')
}

function hueFromName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h % 360
}

export function ConsultantMiniCard({ card, onClick }: Props) {
  const isOver = card.revenue_pct >= 100
  const realizedPctCapped = Math.min(100, card.revenue_pct)
  const overflowPct = card.revenue_pct > 100 ? Math.round(card.revenue_pct - 100) : 0
  const hue = hueFromName(card.commercial_name)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative w-full text-left rounded-2xl border border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
        'shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]',
        'overflow-hidden flex items-stretch transition-all',
        'hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-12px_rgba(0,0,0,0.16)]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2',
      )}
    >
      {/* Square photo — full bleed from the left, spans card height */}
      <div className="w-24 sm:w-28 shrink-0 relative bg-muted/30">
        {card.profile_photo_url ? (
          <img
            src={card.profile_photo_url}
            alt={card.commercial_name}
            className="absolute inset-0 h-full w-full object-cover [object-position:center_15%]"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, hsl(${hue} 60% 88%), hsl(${(hue + 40) % 360} 60% 80%))`,
              color: `hsl(${hue} 60% 25%)`,
            }}
          >
            <span className="text-lg font-semibold">{initials(card.commercial_name)}</span>
          </div>
        )}
      </div>

      {/* Right column: name + status + progress */}
      <div className="flex-1 min-w-0 px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <h3 className="text-sm font-semibold tracking-tight truncate">
            {card.commercial_name || '—'}
          </h3>
          <span
            className={cn(
              'text-[11px] tabular-nums font-medium inline-flex items-center gap-0.5 shrink-0',
              isOver ? 'text-emerald-700' : 'text-muted-foreground',
            )}
          >
            {isOver && <TrendingUp className="h-2.5 w-2.5" />}
            {Math.round(card.revenue_pct)}%
          </span>
        </div>

        <p className={cn('text-[11px] font-medium inline-flex items-center gap-1.5 mb-2', STATUS_TEXT[card.status])}>
          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[card.status])} />
          {STATUS_LABEL[card.status]}
        </p>

        <div className="h-1.5 rounded-full overflow-hidden bg-muted/60 ring-1 ring-border/30 relative mb-1">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isOver ? 'bg-emerald-500' : STATUS_BAR[card.status],
            )}
            style={{ width: `${realizedPctCapped}%` }}
          />
          {overflowPct > 0 && (
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-white tracking-tight pointer-events-none">
              +{overflowPct}%
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold tabular-nums tracking-tight">
            {eurFormatter.format(card.realized_eur)}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums truncate">
            obj {eurFormatter.format(card.period_target_eur)}
          </span>
        </div>
      </div>
    </button>
  )
}
