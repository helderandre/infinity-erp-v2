'use client'

import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FunnelStageResult, FunnelStageStatus } from '@/types/funnel'

interface Props {
  stage: FunnelStageResult
  index: number
  isLast: boolean
  onRegisterManual?: () => void
}

const STATUS_BAR_COLOR: Record<FunnelStageStatus, string> = {
  late: 'bg-red-500',
  attention: 'bg-amber-500',
  on_track: 'bg-emerald-500',
  completed: 'bg-emerald-500',
  pending: 'bg-slate-300',
}

const STATUS_DOT_COLOR: Record<FunnelStageStatus, string> = {
  late: 'bg-red-500 text-white',
  attention: 'bg-amber-500 text-white',
  on_track: 'bg-emerald-500 text-white',
  completed: 'bg-emerald-500 text-white',
  pending: 'bg-slate-200 text-slate-600',
}

const STATUS_TEXT_COLOR: Record<FunnelStageStatus, string> = {
  late: 'text-red-600',
  attention: 'text-amber-600',
  on_track: 'text-emerald-600',
  completed: 'text-emerald-600',
  pending: 'text-muted-foreground',
}

export function FunnelStageRow({ stage, index, isLast, onRegisterManual }: Props) {
  const realizedDisplay = stage.realized
  const targetDisplay = Math.max(stage.target, 0)
  const targetRounded = targetDisplay >= 1 ? Math.round(targetDisplay) : Number(targetDisplay.toFixed(1))
  const widthPct = Math.min(100, stage.percent)
  const hasManual = stage.source_breakdown.manual > 0

  return (
    <div className="flex gap-3 group">
      {/* Connector + numbered dot */}
      <div className="flex flex-col items-center pt-1.5">
        <div
          className={cn(
            'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0',
            STATUS_DOT_COLOR[stage.status],
          )}
        >
          {index + 1}
        </div>
        {!isLast && <div className="flex-1 w-px bg-border mt-1" />}
      </div>

      <div className="flex-1 min-w-0 pb-4">
        {/* Title row */}
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium tracking-tight truncate">{stage.label}</span>
            {hasManual && (
              <span
                title={`${stage.source_breakdown.manual} registado manualmente`}
                className="text-[10px] font-medium text-amber-700 bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 rounded-full px-1.5 py-0.5 leading-none shrink-0"
              >
                +{stage.source_breakdown.manual} manual
              </span>
            )}
          </div>
          <div className="text-sm tabular-nums shrink-0">
            <span className="font-semibold">{realizedDisplay}</span>
            <span className="text-muted-foreground"> / {targetRounded}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 rounded-full overflow-hidden bg-[repeating-linear-gradient(135deg,_transparent_0_4px,_rgba(0,0,0,0.05)_4px_8px)] ring-1 ring-border/40">
          <div
            className={cn('h-full transition-all rounded-full', STATUS_BAR_COLOR[stage.status])}
            style={{ width: `${widthPct}%` }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <span className={cn('text-[11px] font-medium tabular-nums', STATUS_TEXT_COLOR[stage.status])}>
            {stage.target > 0 ? `${Math.round(stage.percent)}% do objetivo` : '—'}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('text-[11px] truncate', STATUS_TEXT_COLOR[stage.status])}>{stage.message}</span>
            {onRegisterManual && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRegisterManual}
                className="h-5 w-5 opacity-40 hover:opacity-100 group-hover:opacity-100 transition-opacity shrink-0"
                title="Registar manualmente"
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
