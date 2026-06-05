'use client'

import { Key, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FunnelStageRow } from './funnel-stage-row'
import type { FunnelData, FunnelStageStatus, FunnelStageKey } from '@/types/funnel'

interface Props {
  data: FunnelData
  onRegisterManual?: (stageKey: FunnelStageKey) => void
}

const STATUS_PILL: Record<FunnelStageStatus, { bg: string; text: string; dot: string; label: string }> = {
  late:       { bg: 'bg-red-50/80',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Atrasado' },
  attention:  { bg: 'bg-amber-50/80',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Atenção' },
  on_track:   { bg: 'bg-emerald-50/80', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Em linha' },
  completed:  { bg: 'bg-emerald-50/80', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Concluído' },
  pending:    { bg: 'bg-muted/60',      text: 'text-muted-foreground', dot: 'bg-slate-400',   label: 'Pendente' },
}

const eurFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

export function FunnelCard({ data, onRegisterManual }: Props) {
  const isBuyer = data.funnel === 'buyer'
  const Icon = isBuyer ? Key : Home
  const title = isBuyer ? 'Funil Compradores' : 'Funil Vendedores'
  const subtitle = `${data.stages.length} etapas`
  const pill = STATUS_PILL[data.status]

  return (
    <div className="rounded-2xl border border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl shadow-[0_12px_30px_-8px_rgba(0,0,0,0.18),0_4px_10px_-6px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col h-full transition-all hover:shadow-[0_16px_36px_-10px_rgba(0,0,0,0.22),0_6px_14px_-6px_rgba(0,0,0,0.16)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ring-1',
                isBuyer
                  ? 'bg-amber-50 text-amber-700 ring-amber-200/60'
                  : 'bg-rose-50 text-rose-700 ring-rose-200/60',
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">
                {subtitle}
              </p>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight truncate">{title}</h2>
            </div>
          </div>
          <div
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shrink-0 backdrop-blur-sm',
              pill.bg,
              pill.text,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', pill.dot)} />
            {pill.label}
          </div>
        </div>
      </div>

      {/* Stages */}
      <div className="px-5 py-5 flex-1">
        {data.stages.map((stage, idx) => (
          <FunnelStageRow
            key={stage.key}
            stage={stage}
            index={idx}
            isLast={idx === data.stages.length - 1}
            onRegisterManual={
              onRegisterManual ? () => onRegisterManual(stage.key as FunnelStageKey) : undefined
            }
          />
        ))}
      </div>

      {/* Footer — 3 KPIs styled like dashboard KpiCards */}
      <div className="border-t border-border/40 bg-muted/20 px-3 py-3 grid grid-cols-3 gap-2">
        <FooterKpi
          label="Conv. Total"
          value={`${data.summary.conv_total_pct.toLocaleString('pt-PT', { maximumFractionDigits: 1 })}%`}
          danger={data.summary.conv_total_pct === 0}
        />
        <FooterKpi
          label="Realizado"
          value={eurFormatter.format(data.summary.realized_eur)}
          danger={data.summary.realized_eur === 0}
        />
        <FooterKpi
          label="Tempo Médio"
          value={data.summary.avg_cycle_days != null ? `${data.summary.avg_cycle_days} dias` : '—'}
        />
      </div>
    </div>
  )
}

function FooterKpi({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-background/60 backdrop-blur-sm px-3 py-2 text-center min-w-0">
      <p className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase truncate">{label}</p>
      <p className={cn('text-sm sm:text-base font-semibold tracking-tight tabular-nums mt-0.5 truncate', danger && 'text-red-600')}>
        {value}
      </p>
    </div>
  )
}
