'use client'

/**
 * Sheet com a vista agregada dos objectivos de TODOS os consultores —
 * gated para CEO / admin / Office Manager. Consome o endpoint existente
 * `/api/goals/team-summary` e mostra:
 *   - KPIs agregados no topo (objectivo total, realizado, projecção, %)
 *   - Lista de consultores com barra de progresso, badge de estado e
 *     deltas relativos ao período.
 *
 * O detalhe individual continua em /dashboard/objetivos/equipa — este
 * sheet é o quick-look directamente do dashboard de gestão.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ExternalLink, TrendingUp, TrendingDown, Target, Trophy, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TeamSummaryResponse, TeamSummaryRow } from '@/app/api/goals/team-summary/route'

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
})
const fmtCompact = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1,
})

interface TeamGoalsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_TONE: Record<string, { bg: string; text: string; label: string }> = {
  on_track: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'No alvo' },
  ahead: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'À frente' },
  at_risk: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Em risco' },
  behind: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Atrasado' },
  off_track: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Fora do alvo' },
  unknown: { bg: 'bg-slate-500/10', text: 'text-slate-600', label: '—' },
}

export function TeamGoalsSheet({ open, onOpenChange }: TeamGoalsSheetProps) {
  const [data, setData] = useState<TeamSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    const year = new Date().getFullYear()
    fetch(`/api/goals/team-summary?year=${year}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: TeamSummaryResponse | null) => {
        if (cancelled || !json) return
        setData(json)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col bg-background/95 backdrop-blur-2xl"
      >
        <SheetHeader className="px-6 pt-8 pb-4">
          <SheetTitle className="text-[20px] font-semibold tracking-tight">
            Objectivos da equipa
          </SheetTitle>
          <SheetDescription className="text-xs">
            Visão agregada de {new Date().getFullYear()} — todos os consultores activos com objectivo definido.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-5">
          {loading || !data ? (
            <div className="space-y-3">
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          ) : data.consultants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Target className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm">Nenhum consultor com objectivo definido para {data.year}.</p>
              <Button asChild variant="outline" size="sm" className="mt-4 rounded-full">
                <Link href="/dashboard/objetivos/equipa">Ir para Objectivos</Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Aggregate KPIs */}
              <div className="rounded-2xl border bg-gradient-to-br from-emerald-500/5 to-transparent ring-1 ring-border/40 p-5">
                <div className="grid grid-cols-2 gap-4">
                  <KpiTile
                    label="Objectivo total"
                    value={fmt.format(data.totals.annual_target)}
                  />
                  <KpiTile
                    label="Realizado YTD"
                    value={fmt.format(data.totals.realized)}
                    sub={`${data.totals.consultants_count} consultor${data.totals.consultants_count === 1 ? '' : 'es'}`}
                  />
                  <KpiTile
                    label="% atingido"
                    value={`${Math.round(data.totals.pct_achieved)}%`}
                    valueClass={
                      data.totals.pct_achieved >= 80 ? 'text-emerald-600'
                        : data.totals.pct_achieved >= 50 ? 'text-amber-600'
                          : 'text-red-600'
                    }
                  />
                  <KpiTile
                    label="Projecção anual"
                    value={fmtCompact.format(data.totals.projected_annual)}
                    deltaIcon={data.totals.projected_annual >= data.totals.annual_target ? 'up' : 'down'}
                  />
                </div>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy className="h-3 w-3 text-emerald-600" />
                    {data.totals.reports_submitted}/{data.totals.consultants_count} relatórios entregues
                  </span>
                  {data.totals.reports_pending > 0 && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="inline-flex items-center gap-1.5 text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        {data.totals.reports_pending} em falta
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Per-consultant list */}
              <div className="space-y-2">
                {data.consultants.map((c) => (
                  <ConsultantRow key={c.goal_id} row={c} />
                ))}
              </div>

              <div className="pt-2 border-t">
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <Link href="/dashboard/objetivos/equipa" onClick={() => onOpenChange(false)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Abrir página completa
                  </Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function KpiTile({
  label, value, sub, valueClass, deltaIcon,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
  deltaIcon?: 'up' | 'down'
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-1">
        <p className={cn('text-xl font-bold tabular-nums tracking-tight', valueClass)}>{value}</p>
        {deltaIcon === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
        {deltaIcon === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
      </div>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function ConsultantRow({ row }: { row: TeamSummaryRow }) {
  const tone = STATUS_TONE[row.status as string] ?? STATUS_TONE.unknown
  const pct = Math.min(row.pct_achieved, 100)
  const initials = row.commercial_name?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <Link
      href={`/dashboard/objetivos/${row.goal_id}`}
      className="flex items-center gap-3 rounded-xl border bg-background hover:bg-muted/40 px-3 py-2.5 transition-colors"
    >
      <Avatar className="h-9 w-9 shrink-0">
        {row.profile_photo_url && <AvatarImage src={row.profile_photo_url} alt="" />}
        <AvatarFallback className="text-[11px]">{initials || '?'}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-medium truncate">{row.commercial_name}</p>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0', tone.bg, tone.text)}>
            {tone.label}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                row.pct_achieved >= 80 ? 'bg-emerald-500'
                  : row.pct_achieved >= 50 ? 'bg-amber-500'
                    : 'bg-red-500',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold tabular-nums w-9 text-right">
            {Math.round(row.pct_achieved)}%
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
          <span>{fmtCompact.format(row.realized)} de {fmtCompact.format(row.annual_target)}</span>
          <span>Projecção: {fmtCompact.format(row.projected_annual)}</span>
        </div>
      </div>
    </Link>
  )
}
