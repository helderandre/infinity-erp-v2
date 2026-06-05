'use client'

import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ChevronRight, TrendingUp } from 'lucide-react'
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

export function ConsultantListRow({ card, onClick }: Props) {
  const isOver = card.revenue_pct >= 100
  const realizedPctCapped = Math.min(100, card.revenue_pct)
  const overflowPct = card.revenue_pct > 100 ? Math.round(card.revenue_pct - 100) : 0
  const hue = hueFromName(card.commercial_name)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full text-left grid items-center gap-4 px-4 py-3 rounded-xl',
        'border border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
        'shadow-[0_4px_12px_-6px_rgba(0,0,0,0.08)]',
        'transition-all hover:bg-background/95 hover:shadow-[0_8px_18px_-8px_rgba(0,0,0,0.14)]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2',
        // Avatar+name | status | realized | chevron
        'grid-cols-[minmax(180px,2fr)_minmax(110px,auto)_minmax(220px,3fr)_24px]',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar
          className="h-9 w-9 ring-1 ring-border/40 shrink-0"
          style={
            !card.profile_photo_url
              ? {
                  background: `linear-gradient(135deg, hsl(${hue} 60% 88%), hsl(${(hue + 40) % 360} 60% 80%))`,
                }
              : undefined
          }
        >
          {card.profile_photo_url && (
            <AvatarImage src={card.profile_photo_url} alt={card.commercial_name} />
          )}
          <AvatarFallback
            className="bg-transparent text-[11px] font-semibold"
            style={{ color: `hsl(${hue} 60% 30%)` }}
          >
            {initials(card.commercial_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight truncate">
            {card.commercial_name || '—'}
          </p>
          <p className="text-[10px] text-muted-foreground tracking-wider uppercase font-medium">
            Consultor
          </p>
        </div>
      </div>

      <div className={cn('inline-flex items-center gap-1.5 text-xs font-medium', STATUS_TEXT[card.status])}>
        <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[card.status])} />
        {STATUS_LABEL[card.status]}
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-sm font-semibold tabular-nums tracking-tight truncate">
            {eurFormatter.format(card.realized_eur)}
            <span className="text-muted-foreground font-normal text-[11px]">
              {' / '}
              {eurFormatter.format(card.period_target_eur)}
            </span>
          </span>
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
        <div className="h-1 rounded-full overflow-hidden bg-muted/60 ring-1 ring-border/30 relative">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isOver ? 'bg-emerald-500' : STATUS_BAR[card.status],
            )}
            style={{ width: `${realizedPctCapped}%` }}
          />
          {overflowPct > 0 && (
            <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[7px] font-bold text-white tracking-tight pointer-events-none">
              +{overflowPct}%
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  )
}
