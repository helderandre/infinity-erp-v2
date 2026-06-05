'use client'

/**
 * Slide 4 of the manager mobile carousel — overview KPIs (YTD facturação,
 * margem, pipeline ponderado, carteira) + the "valores em curso" pipeline
 * group + previsões for the next period. Mirrors the Visão Geral tab of the
 * PC ManagementDashboard.
 */

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Banknote, PiggyBank, Handshake, Building2,
  FileSignature, FileCheck, CreditCard,
  Receipt, Wallet, Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FinanceiroKpiCard, FinanceiroPipelineCard,
} from '@/components/dashboard/shared/financeiro-style'
import {
  MobileDrillDownSheet, type MobileDrillDownConfig,
} from './mobile-drill-down-sheet'
import {
  getDrillDownProperties, getDrillDownTransactions,
} from '@/app/dashboard/drill-down-actions'
import type {
  ManagementDashboard as MgmtData, RevenuePipelineItem,
} from '@/types/financial'

const fmt = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
})
const fmtCompact = new Intl.NumberFormat('pt-PT', {
  style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1,
})

interface ManagerOverviewCardProps {
  data: MgmtData | null
  pipeline: RevenuePipelineItem[]
  loading: boolean
  fillViewport?: boolean
}

export function ManagerOverviewCard({
  data, pipeline, loading, fillViewport,
}: ManagerOverviewCardProps) {
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
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-32 rounded-2xl" />
      </Card>
    )
  }

  const { reporting: rpt, margin: mg, portfolio: pf, forecasts: fc } = data
  const pipeTotal = pipeline.reduce((s, p) => s + p.weighted_value, 0)

  return (
    <>
      <Card className={cardClass}>
        <div>
          <h3 className="text-base font-semibold tracking-tight">Visão Geral</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Indicadores acumulados deste ano
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FinanceiroKpiCard
            icon={Banknote}
            label="Facturação YTD"
            value={fmt.format(rpt.reported_this_year)}
            tone="positive"
            onClick={() => drill({
              title: 'Facturação Este Ano',
              fetcher: () => getDrillDownTransactions({
                status: 'paid',
                date_from: `${new Date().getFullYear()}-01-01`,
              }),
            })}
          />
          <FinanceiroKpiCard
            icon={PiggyBank}
            label="Margem YTD"
            value={fmt.format(mg.margin_this_year)}
            tone="info"
          />
          <FinanceiroKpiCard
            icon={Handshake}
            label="Pipeline ponderado"
            value={fmt.format(pipeTotal)}
            hint={`${pipeline.length} negócios`}
            tone="purple"
            onClick={() => drill({
              title: 'Pipeline Activo',
              fetcher: () => getDrillDownProperties({ status: ['active'] }),
            })}
          />
          <FinanceiroKpiCard
            icon={Building2}
            label="Carteira activa"
            value={fmt.format(pf.active_volume)}
            hint={`${fmtCompact.format(pf.potential_revenue)} potencial`}
            tone="warning"
            onClick={() => drill({
              title: 'Imóveis Activos',
              fetcher: () => getDrillDownProperties({ status: 'active' }),
            })}
          />
        </div>

        <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-4 space-y-3">
          <p className="text-xs font-semibold tracking-tight">Valores em curso</p>
          <div className="space-y-2">
            <FinanceiroPipelineCard
              icon={FileSignature}
              label="Por reportar"
              value={fmt.format(rpt.signed_pending)}
              tone="warning"
              onClick={() => drill({
                title: 'Por Reportar',
                fetcher: () => getDrillDownTransactions({ status: 'approved' }),
              })}
            />
            <FinanceiroPipelineCard
              icon={FileCheck}
              label="Por receber"
              value={fmt.format(mg.pending_collection)}
              tone="info"
              onClick={() => drill({
                title: 'Por Receber',
                fetcher: () => getDrillDownTransactions({ status: 'approved' }),
              })}
            />
            <FinanceiroPipelineCard
              icon={CreditCard}
              label="Receita potencial"
              value={fmt.format(pf.potential_revenue)}
              tone="purple"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-tight mb-2">Previsões</p>
          <div className="grid grid-cols-2 gap-3">
            <FinanceiroKpiCard
              icon={Receipt}
              label="Facturação prevista"
              value={fmt.format(fc.expected_revenue)}
              tone="positive"
            />
            <FinanceiroKpiCard
              icon={Wallet}
              label="Margem prevista"
              value={fmt.format(fc.expected_margin)}
              tone="info"
            />
            <FinanceiroKpiCard
              icon={Target}
              label="Negócios a fechar"
              value={String(fc.expected_deals)}
              tone="purple"
            />
            <FinanceiroKpiCard
              icon={FileSignature}
              label="Pendentes aprovação"
              value={String(fc.pending_acquisitions)}
              tone="warning"
              onClick={() => drill({
                title: 'Pendentes Aprovação',
                fetcher: () => getDrillDownProperties({ status: 'pending_approval' }),
              })}
            />
          </div>
        </div>
      </Card>

      <MobileDrillDownSheet config={config} open={open} onOpenChange={setOpen} />
    </>
  )
}
