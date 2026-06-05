'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface FunnelStageBoxProps {
  label: string
  annual: number
  weekly?: number
  icon?: LucideIcon
  /** Visual emphasis for terminal nodes (Fechos) */
  emphasis?: 'normal' | 'terminal'
  /** Subtitle hint, e.g. "via 95% CPCV→Escritura" */
  hint?: string
  /** Smaller padding + text. Used in compact preview diagrams. */
  size?: 'default' | 'compact'
}

function fmtAnnual(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Math.round(n))
}

function fmtWeekly(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 10) return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Math.round(n))
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(n)
}

export function FunnelStageBox({
  label,
  annual,
  weekly,
  icon: Icon,
  emphasis = 'normal',
  hint,
  size = 'default',
}: FunnelStageBoxProps) {
  const isTerminal = emphasis === 'terminal'
  const isCompact = size === 'compact'
  return (
    <div
      className={cn(
        'w-full rounded-xl border backdrop-blur-sm transition-colors',
        isCompact ? 'px-3 py-2' : 'px-4 py-3',
        isTerminal
          ? 'border-emerald-500/40 bg-emerald-50/60 supports-[backdrop-filter]:bg-emerald-50/40 text-emerald-900 shadow-sm'
          : 'border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 hover:border-border/60'
      )}
    >
      <div className={cn(
        'flex items-center gap-1.5 uppercase tracking-wide font-medium',
        isCompact ? 'text-[10px]' : 'text-[11px]',
        isTerminal ? 'text-emerald-700/80' : 'text-muted-foreground',
      )}>
        {Icon && <Icon className={cn(isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3')} />}
        {label}
      </div>
      <div className={cn('mt-0.5 flex items-baseline gap-2', isTerminal ? 'text-emerald-900' : 'text-foreground')}>
        <span className={cn(
          'font-bold tabular-nums leading-none',
          isCompact ? 'text-base' : 'text-2xl',
        )}>
          {fmtAnnual(annual)}
        </span>
        <span className={cn(
          isCompact ? 'text-[10px]' : 'text-xs',
          isTerminal ? 'text-emerald-700/70' : 'text-muted-foreground',
        )}>/ano</span>
      </div>
      {weekly !== undefined && !isCompact && (
        <div className={cn('mt-1 text-[11px]', isTerminal ? 'text-emerald-700/70' : 'text-muted-foreground')}>
          ~{fmtWeekly(weekly)} por semana
        </div>
      )}
      {hint && (
        <div className={cn(
          'mt-1 italic',
          isCompact ? 'text-[9px]' : 'text-[10px]',
          isTerminal ? 'text-emerald-700/60' : 'text-muted-foreground/70',
        )}>
          {hint}
        </div>
      )}
    </div>
  )
}
