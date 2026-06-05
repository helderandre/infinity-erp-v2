'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface FunnelListRowProps {
  index: number
  icon?: LucideIcon
  label: string
  /** Annual count — caller is responsible for any period scaling */
  count: number
  periodSuffix?: string
  /** Inline subtitle: conversion ratio prose */
  subtitle?: string
  /** Visual emphasis for the terminal Fechos row */
  emphasis?: 'normal' | 'terminal'
  /** Realized count YTD for this stage. Bar shown when annualTarget > 0. */
  realizedYtd?: number
  /** Subset of realizedYtd that came from manual entries (rest = auto) */
  realizedManual?: number
  /** Annual target for computing % achieved */
  annualTarget?: number
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 10) return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(Math.round(n))
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(n)
}

export function FunnelListRow({
  index,
  icon: Icon,
  label,
  count,
  periodSuffix = '/ano',
  subtitle,
  emphasis = 'normal',
  realizedYtd,
  realizedManual,
  annualTarget,
}: FunnelListRowProps) {
  const isTerminal = emphasis === 'terminal'
  const hasBar = annualTarget !== undefined && annualTarget > 0
  const totalRealized = realizedYtd ?? 0
  const manualRealized = realizedManual ?? 0
  const autoRealized = Math.max(0, totalRealized - manualRealized)
  const achievedPct = hasBar ? Math.min(100, (totalRealized / annualTarget) * 100) : 0
  const autoPct = hasBar ? Math.min(100, (autoRealized / annualTarget) * 100) : 0
  const manualPct = hasBar ? Math.min(100, (manualRealized / annualTarget) * 100) : 0

  return (
    <div className="space-y-1.5 py-2">
      <div className="flex items-center gap-3">
        {/* Index chip */}
        <div
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
            isTerminal
              ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-500/30'
              : 'bg-rose-100 text-rose-600 ring-1 ring-rose-500/20'
          )}
        >
          {index}
        </div>

        {/* Stage name */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {Icon && (
            <Icon
              className={cn('h-3.5 w-3.5 shrink-0', isTerminal ? 'text-emerald-600' : 'text-muted-foreground')}
            />
          )}
          <span className={cn('truncate text-sm', isTerminal ? 'font-semibold text-emerald-900' : 'font-medium')}>
            {label}
          </span>
        </div>

        {/* Count */}
        <div className={cn('shrink-0 text-right tabular-nums', isTerminal ? 'text-emerald-900' : 'text-foreground')}>
          <span className="text-base font-bold">{fmt(count)}</span>
          <span className={cn('ml-1 text-[11px]', isTerminal ? 'text-emerald-700/70' : 'text-muted-foreground')}>
            {periodSuffix}
          </span>
        </div>
      </div>

      {/* Single bar = realized progress (auto + manual two-tone) */}
      {hasBar && (
        <div className="ml-9 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/30 flex">
            <div
              className={cn('h-full transition-all', autoPct >= 100 ? 'bg-emerald-500' : 'bg-emerald-400/70')}
              style={{ width: `${autoPct}%` }}
              title={`Automático: ${fmt(autoRealized)}`}
            />
            <div
              className="h-full transition-all bg-amber-400/70"
              style={{ width: `${Math.min(100 - autoPct, manualPct)}%` }}
              title={`Manual: ${fmt(manualRealized)}`}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            <strong className="text-foreground">{fmt(totalRealized)}</strong> · {achievedPct.toFixed(0)}%
          </span>
        </div>
      )}

      {/* Subtitle / conversion text */}
      {subtitle && (
        <p className="ml-9 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
      )}

      {/* Manual breakdown chip — only when both auto + manual present */}
      {hasBar && manualRealized > 0 && (
        <p className="ml-9 text-[10px] text-muted-foreground/80 tabular-nums">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/70 mr-1 align-middle" />
          {fmt(autoRealized)} auto
          <span className="mx-1.5 text-muted-foreground/40">·</span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400/70 mr-1 align-middle" />
          {fmt(manualRealized)} manual
        </p>
      )}
    </div>
  )
}
