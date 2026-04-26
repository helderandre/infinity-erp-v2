'use client'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'
import type { AgentDashboard } from '@/types/financial'

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})
const fmtFull = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
})

interface MargemCardProps {
  data: AgentDashboard | null
  loading: boolean
  fillViewport?: boolean
}

export function MargemCard({ data, loading, fillViewport }: MargemCardProps) {
  const cardClass = cn(
    'rounded-2xl border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.18),0_4px_10px_-6px_rgba(0,0,0,0.12)] p-4 gap-4',
    fillViewport &&
      'h-[calc(100dvh-env(safe-area-inset-top,0px)-var(--mobile-nav-height,5rem)-6rem)] min-h-[24rem]',
  )

  if (loading || !data) {
    return (
      <Card className={cardClass}>
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
      </Card>
    )
  }

  const pct = Math.min(data.pct_achieved, 100)
  const pctColor =
    pct >= 80
      ? 'text-emerald-600'
      : pct >= 50
      ? 'text-amber-600'
      : 'text-red-600'
  const evolution = data.monthly_evolution ?? []
  const barMax = Math.max(
    ...evolution.map((m) => Math.max(m.revenue, m.target)),
    1,
  )

  return (
    <Card className={cardClass}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-sm font-semibold truncate">Financeiro</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative h-9 w-9">
            <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-muted"
              />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className={
                  pct >= 80
                    ? 'text-emerald-500'
                    : pct >= 50
                    ? 'text-amber-500'
                    : 'text-red-500'
                }
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeLinecap="round"
              />
            </svg>
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums',
                pctColor,
              )}
            >
              {Math.round(data.pct_achieved)}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Faturação YTD
          </p>
          <p className="text-base font-bold tabular-nums mt-1">
            {fmt.format(data.revenue_ytd)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            de {fmt.format(data.annual_target)}
          </p>
        </div>
        <div className="rounded-xl bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Este mês
          </p>
          <p className="text-base font-bold tabular-nums mt-1">
            {fmt.format(data.revenue_this_month)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Meta mensal {fmt.format(data.annual_target / 12)}
          </p>
        </div>
      </div>

      <div
        className={cn(
          'rounded-xl bg-neutral-50/60 dark:bg-white/5 border border-neutral-200 dark:border-white/10 p-3 flex flex-col',
          fillViewport && 'flex-1 min-h-0',
        )}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <p className="text-[11px] font-semibold">Evolução mensal</p>
          <div className="flex gap-2 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />
              Faturação
            </span>
            <span className="flex items-center gap-1">
              <span className="h-0 w-3 border-t-2 border-dashed border-amber-400" />
              Meta
            </span>
          </div>
        </div>
        <div
          className={cn(
            'flex items-end gap-1',
            fillViewport ? 'flex-1 min-h-0' : 'h-32',
          )}
        >
          {evolution.map((m, i) => {
            const h = Math.max((m.revenue / barMax) * 100, 3)
            const tH = Math.max((m.target / barMax) * 100, 0)
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center h-full justify-end relative group"
                title={`${m.month}: ${fmtFull.format(m.revenue)} (meta ${fmtFull.format(m.target)})`}
              >
                {m.target > 0 && (
                  <div
                    className="absolute w-[calc(100%+2px)] border-t-2 border-dashed border-amber-400/50"
                    style={{ bottom: `${tH}%` }}
                  />
                )}
                <div
                  className="w-full rounded-t-sm bg-gradient-to-t from-blue-500 to-blue-400 opacity-85"
                  style={{ height: `${h}%` }}
                />
                <span className="text-[8px] text-muted-foreground mt-1 truncate w-full text-center">
                  {m.month.slice(0, 3)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
