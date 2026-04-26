'use client'

/**
 * Slide 5 of the manager mobile carousel — pipeline ponderado por fase
 * (progress bars) + total ponderado + angariações summary. Mirrors the
 * Pipeline tab of the PC ManagementDashboard.
 */

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronRight, TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FinanceiroKpiCard } from '@/components/dashboard/shared/financeiro-style'
import {
  MobileDrillDownSheet, type MobileDrillDownConfig,
} from './mobile-drill-down-sheet'
import {
  getDrillDownProperties, getDrillDownNegocios,
} from '@/app/dashboard/drill-down-actions'
import type {
  ManagementDashboard as MgmtData, RevenuePipelineItem,
} from '@/types/financial'
import type { BuyerPipelineSummary } from '@/app/dashboard/financeiro/actions'

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
})

interface ManagerPipelineCardProps {
  data: MgmtData | null
  pipeline: RevenuePipelineItem[]
  buyerPipeline?: RevenuePipelineItem[]
  buyerSummary?: BuyerPipelineSummary | null
  loading: boolean
  fillViewport?: boolean
}

export function ManagerPipelineCard({
  data, pipeline, buyerPipeline = [], buyerSummary, loading, fillViewport,
}: ManagerPipelineCardProps) {
  const [config, setConfig] = useState<MobileDrillDownConfig | null>(null)
  const [open, setOpen] = useState(false)

  const cardClass = cn(
    'rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)] p-5 gap-5 overflow-y-auto',
    fillViewport && 'h-[calc(100dvh-env(safe-area-inset-top,0px)-var(--mobile-nav-height,5rem)-6rem)] min-h-[24rem]',
  )

  const drill = (cfg: MobileDrillDownConfig) => {
    setConfig(cfg)
    setOpen(true)
  }

  if (loading || !data) {
    return (
      <Card className={cardClass}>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </Card>
    )
  }

  const { acquisitions: acq } = data
  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartIso = monthStart.toISOString().split('T')[0]
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  const monthEndIso = (() => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    return d.toISOString().split('T')[0]
  })()

  // Across-all-statuses total for angariações (active + reserved + sold).
  // The cancelled count is shown separately below — same rationale as the
  // original card.
  const acqTotalActive = (acq.acquired ?? acq.active ?? 0) + (acq.reserved ?? 0) + (acq.sold ?? 0)

  return (
    <>
      <Card className={cardClass}>
        <div>
          <h3 className="text-base font-semibold tracking-tight">Pipeline & Angariações</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Negócios a fechar e estado da carteira (sumário de toda a equipa)
          </p>
        </div>

        {/* ─── Angariações (Vendedores e Senhorios) ─── */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs font-semibold tracking-tight">
              Angariações · {acqTotalActive} {acqTotalActive === 1 ? 'imóvel' : 'imóveis'}
            </p>
            <span className="text-[10px] text-muted-foreground">
              {acq.days_without_acquisition}d sem angariar
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FinanceiroKpiCard
              label="Novas (mês)"
              value={String(acq.new_this_month)}
              tone="positive"
              onClick={() => drill({
                title: 'Novas Angariações',
                fetcher: () => getDrillDownProperties({ created_after: monthStartIso }),
              })}
            />
            <FinanceiroKpiCard
              label="Activas"
              value={String(acq.acquired ?? acq.active ?? 0)}
              tone="info"
              onClick={() => drill({
                title: 'Activas',
                fetcher: () => getDrillDownProperties({ status: ['active', 'available'] }),
              })}
            />
            <FinanceiroKpiCard
              label="Reservadas"
              value={String(acq.reserved)}
              tone="warning"
              onClick={() => drill({
                title: 'Reservadas',
                fetcher: () => getDrillDownProperties({ status: 'reserved' }),
              })}
            />
            <FinanceiroKpiCard
              label="Vendidas"
              value={String(acq.sold)}
              tone="purple"
              onClick={() => drill({
                title: 'Vendidas',
                fetcher: () => getDrillDownProperties({ status: 'sold' }),
              })}
            />
          </div>

          {acq.cancelled > 0 && (
            <button
              onClick={() => drill({
                title: 'Canceladas',
                fetcher: () => getDrillDownProperties({ status: 'cancelled' }),
              })}
              className="mt-3 w-full flex items-center justify-between rounded-xl bg-background/60 ring-1 ring-border/40 px-4 py-3 hover:ring-border/70 transition-all group"
            >
              <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                Canceladas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-bold tabular-nums text-red-600">
                  {acq.cancelled}
                </span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
              </span>
            </button>
          )}
        </div>

        {/* Pipeline weighted bars — Angariações (vendedores e senhorios) */}
        <PipelineSection
          title="Angariações — Pipeline ponderado"
          gradientClass="from-blue-400 to-blue-600"
          rows={pipeline}
        />

        {/* ─── Compradores e Inquilinos ─── */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs font-semibold tracking-tight">
              Compradores e Inquilinos · {buyerSummary?.total ?? 0} {(buyerSummary?.total ?? 0) === 1 ? 'negócio' : 'negócios'}
            </p>
            <span className="text-[10px] text-muted-foreground">
              {buyerSummary?.em_curso ?? 0} em curso
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FinanceiroKpiCard
              label="Em curso"
              value={String(buyerSummary?.em_curso ?? 0)}
              tone="info"
              onClick={() => drill({
                title: 'Negócios em Curso',
                fetcher: () => getDrillDownNegocios({
                  pipeline_types: ['comprador', 'arrendatario'],
                  not_terminal: true,
                }),
              })}
            />
            <FinanceiroKpiCard
              label="A fechar (mês)"
              value={String(buyerSummary?.a_fechar_mes ?? 0)}
              tone="warning"
              onClick={() => drill({
                title: 'A Fechar Este Mês',
                fetcher: () => getDrillDownNegocios({
                  pipeline_types: ['comprador', 'arrendatario'],
                  not_terminal: true,
                  expected_close_from: monthStartIso,
                  expected_close_to: monthEndIso,
                }),
              })}
            />
            <FinanceiroKpiCard
              label="Ganhos (mês)"
              value={String(buyerSummary?.ganhos_mes ?? 0)}
              tone="positive"
              onClick={() => drill({
                title: 'Ganhos Este Mês',
                fetcher: () => getDrillDownNegocios({
                  pipeline_types: ['comprador', 'arrendatario'],
                  terminal_type: 'won',
                  won_from: monthStartIso,
                }),
              })}
            />
            <FinanceiroKpiCard
              label="Ganhos (ano)"
              value={String(buyerSummary?.ganhos_ano ?? 0)}
              tone="purple"
              onClick={() => drill({
                title: 'Ganhos Este Ano',
                fetcher: () => getDrillDownNegocios({
                  pipeline_types: ['comprador', 'arrendatario'],
                  terminal_type: 'won',
                  won_from: yearStart,
                }),
              })}
            />
          </div>

          {(buyerSummary?.perdidos_ano ?? 0) > 0 && (
            <button
              onClick={() => drill({
                title: 'Perdidos Este Ano',
                fetcher: () => getDrillDownNegocios({
                  pipeline_types: ['comprador', 'arrendatario'],
                  terminal_type: 'lost',
                }),
              })}
              className="mt-3 w-full flex items-center justify-between rounded-xl bg-background/60 ring-1 ring-border/40 px-4 py-3 hover:ring-border/70 transition-all group"
            >
              <span className="text-xs text-muted-foreground inline-flex items-center gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                Perdidos (ano)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-bold tabular-nums text-red-600">
                  {buyerSummary?.perdidos_ano}
                </span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
              </span>
            </button>
          )}
        </div>

        {/* Pipeline weighted bars — Compradores e Inquilinos (CRM) */}
        <PipelineSection
          title="Compradores e Inquilinos — Pipeline ponderado"
          gradientClass="from-emerald-400 to-emerald-600"
          rows={buyerPipeline}
        />
      </Card>

      <MobileDrillDownSheet config={config} open={open} onOpenChange={setOpen} />
    </>
  )
}

function PipelineSection({
  title,
  rows,
  gradientClass,
}: {
  title: string
  rows: RevenuePipelineItem[]
  gradientClass: string
}) {
  const total = rows.reduce((s, r) => s + r.weighted_value, 0)
  const totalCount = rows.reduce((s, r) => s + r.count, 0)
  const max = Math.max(...rows.map((r) => r.weighted_value), 1)

  return (
    <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-4 space-y-3">
      <p className="text-xs font-semibold tracking-tight">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Sem negócios activos</p>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <div key={p.stage}>
              <div className="flex justify-between text-xs mb-1 gap-2">
                <span className="font-medium truncate">{p.label}</span>
                <span className="shrink-0 inline-flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {p.count} {p.count === 1 ? 'negócio' : 'negócios'}
                  </span>
                  <span className="font-bold tabular-nums">{fmt.format(p.weighted_value)}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full bg-gradient-to-r transition-all duration-500',
                      gradientClass,
                    )}
                    style={{ width: `${(p.weighted_value / max) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground w-9 text-right tabular-nums">
                  {Math.round(p.probability * 100)}%
                </span>
              </div>
            </div>
          ))}
          <div className="rounded-xl bg-muted/30 p-3 flex items-center justify-between mt-1">
            <span className="text-xs font-medium">
              Total ponderado · {totalCount} {totalCount === 1 ? 'negócio' : 'negócios'}
            </span>
            <span className="text-base font-bold tabular-nums">{fmt.format(total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
