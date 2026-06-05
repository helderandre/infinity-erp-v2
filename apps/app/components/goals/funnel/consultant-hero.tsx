'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TrendingUp, ArrowLeft, Sparkles } from 'lucide-react'
import type { FunnelResponse, FunnelPeriod, FunnelStageStatus } from '@/types/funnel'

interface Props {
  data: FunnelResponse
  period: FunnelPeriod
  onPeriodChange: (p: FunnelPeriod) => void
  onCoachOpen?: () => void
  backHref?: string
}

const PERIOD_OPTIONS: { value: FunnelPeriod; label: string }[] = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'annual', label: 'Anual' },
]

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

const PERIOD_LABEL_FULL: Record<FunnelPeriod, string> = {
  daily: 'Hoje',
  weekly: 'Esta semana',
  monthly: 'Este mês',
  annual: 'Este ano',
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

function firstName(full: string): string {
  return full.split(/\s+/).filter(Boolean)[0] || full
}

export function ConsultantHero({
  data,
  period,
  onPeriodChange,
  onCoachOpen,
  backHref = '/dashboard/objetivos?view=individual',
}: Props) {
  const overallStatus: FunnelStageStatus =
    data.buyer.status === 'late' || data.seller.status === 'late'
      ? 'late'
      : data.buyer.status === 'attention' || data.seller.status === 'attention'
        ? 'attention'
        : 'on_track'

  const realizedTotal = data.buyer.summary.realized_eur + data.seller.summary.realized_eur
  const revenuePct =
    data.period_target_eur > 0
      ? Math.round((realizedTotal / data.period_target_eur) * 100)
      : 0
  const isOver = revenuePct >= 100
  const hue = hueFromName(data.consultant.commercial_name || '')
  const name = data.consultant.commercial_name || '—'

  return (
    <div
      className={cn(
        'rounded-3xl border border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
        'shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]',
        'overflow-hidden flex flex-col sm:flex-row items-stretch',
      )}
    >
      {/* Photo on the left — full bleed square, slightly narrower */}
      <div className="shrink-0 relative w-full sm:w-[140px] h-32 sm:h-auto bg-muted/30">
        {data.consultant.profile_photo_url ? (
          <img
            src={data.consultant.profile_photo_url}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover [object-position:center_15%]"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, hsl(${hue} 60% 78%), hsl(${(hue + 40) % 360} 60% 70%))`,
              color: `hsl(${hue} 60% 25%)`,
            }}
          >
            <span className="text-2xl font-semibold">{initials(name)}</span>
          </div>
        )}

        {/* Glassmorphic back arrow — overlay on photo top-left */}
        <Link
          href={backHref}
          aria-label="Voltar à equipa"
          className={cn(
            'absolute top-2.5 left-2.5 h-7 w-7 inline-flex items-center justify-center rounded-full',
            'bg-background/70 backdrop-blur-md border border-border/40',
            'text-foreground/80 hover:text-foreground',
            'shadow-sm transition-all hover:bg-background/90',
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Right side: top controls + content */}
      <div className="flex-1 min-w-0 px-5 py-3 sm:px-6 sm:py-4 flex flex-col gap-2">
        {/* Top row — period picker + coach (right aligned) */}
        <div className="flex items-center justify-end gap-2">
          <div className="inline-flex items-center rounded-full border border-border/40 bg-muted/40 backdrop-blur-sm p-0.5 text-[11px] font-medium">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onPeriodChange(opt.value)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 transition-all',
                  period === opt.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {onCoachOpen && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCoachOpen}
              className="rounded-full h-7 text-[11px] gap-1.5 border-border/40 bg-background/60 backdrop-blur-sm"
            >
              <Sparkles className="h-3 w-3 text-orange-500" />
              Coach
            </Button>
          )}
        </div>

        {/* Identity + status */}
        <div>
          <p className="text-[10px] text-muted-foreground tracking-wider uppercase font-medium">
            Objectivos · {PERIOD_LABEL_FULL[period]}
          </p>
          <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate leading-tight">
              {firstName(name)}
            </h1>
            <span className="text-xs text-muted-foreground truncate">{name}</span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 backdrop-blur-sm',
                overallStatus === 'late'
                  ? 'bg-red-50/80 text-red-700 ring-red-200/60'
                  : overallStatus === 'attention'
                    ? 'bg-amber-50/80 text-amber-700 ring-amber-200/60'
                    : 'bg-emerald-50/80 text-emerald-700 ring-emerald-200/60',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[overallStatus])} />
              {STATUS_LABEL[overallStatus]}
            </span>
          </div>
        </div>

        {/* Realized + % */}
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] text-muted-foreground tracking-wider uppercase font-medium">
              Realizado
            </p>
            <p className="text-base sm:text-lg font-semibold tabular-nums tracking-tight leading-tight">
              {eurFormatter.format(realizedTotal)}
              <span className="text-xs text-muted-foreground font-normal">
                {' / '}
                {eurFormatter.format(data.period_target_eur)}
              </span>
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] text-muted-foreground tracking-wider uppercase font-medium">
              % atingido
            </p>
            <p
              className={cn(
                'text-base sm:text-lg font-semibold tabular-nums tracking-tight inline-flex items-baseline gap-1 leading-tight',
                isOver ? 'text-emerald-700' : STATUS_TEXT[overallStatus],
              )}
            >
              {isOver && <TrendingUp className="h-3 w-3 self-center" />}
              {Math.min(999, revenuePct)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
