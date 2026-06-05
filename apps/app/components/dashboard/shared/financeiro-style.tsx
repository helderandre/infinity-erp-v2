'use client'

/**
 * Shared visual primitives following the financeiro dashboard design language.
 *
 * These are intentionally a thin set: pastel-gradient KPI tiles, a section
 * wrapper that hosts them, a pipeline group, and a month picker pill. The
 * tones (positive/negative/warning/info/purple/neutral) match the ones used
 * in [components/financial/financial-dashboard-tab.tsx] so the visual
 * language stays consistent — keep them in sync if you adjust either side.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Tones

export type FinanceiroTone =
  | 'neutral'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'info'
  | 'purple'

const TONE_MAP: Record<FinanceiroTone, { from: string; icon: string; accent: string }> = {
  neutral:  { from: 'from-slate-500/10',   icon: 'text-slate-600 dark:text-slate-300', accent: 'bg-slate-400/40' },
  positive: { from: 'from-emerald-500/15', icon: 'text-emerald-600',                    accent: 'bg-emerald-500/60' },
  negative: { from: 'from-red-500/15',     icon: 'text-red-600',                        accent: 'bg-red-500/60' },
  warning:  { from: 'from-amber-500/15',   icon: 'text-amber-600',                      accent: 'bg-amber-500/60' },
  info:     { from: 'from-blue-500/15',    icon: 'text-blue-600',                       accent: 'bg-blue-500/60' },
  purple:   { from: 'from-purple-500/15',  icon: 'text-purple-600',                     accent: 'bg-purple-500/60' },
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionCard — the rounded-3xl wrapper that hosts groups of KPIs/charts

export function SectionCard({
  title,
  description,
  rightSlot,
  children,
  className,
}: {
  title?: string
  description?: string
  rightSlot?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card
      className={cn(
        'rounded-3xl border-0 ring-1 ring-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm p-6 space-y-6 shadow-[0_2px_24px_-12px_rgb(0_0_0_/_0.12)]',
        className,
      )}
    >
      {(title || rightSlot) && (
        <div className="flex items-end justify-between gap-3">
          <div>
            {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
            {description && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {rightSlot}
        </div>
      )}
      {children}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KpiCard — pastel gradient tile with optional icon, value, hint, click

export function FinanceiroKpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
  onClick,
  className,
}: {
  icon?: React.ElementType
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: FinanceiroTone
  onClick?: () => void
  className?: string
}) {
  const t = TONE_MAP[tone]
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-gradient-to-br to-transparent text-left w-full',
        'ring-1 ring-border/40 p-4 transition-all duration-300',
        'hover:ring-border/70 hover:shadow-[0_4px_20px_-4px_rgb(0_0_0_/_0.08)]',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        t.from,
        className,
      )}
    >
      <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', t.accent)} />

      <div className="flex items-center gap-2">
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', t.icon)} />}
        <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>
      </div>
      <p className="text-base sm:text-2xl font-semibold tracking-tight tabular-nums mt-2.5 text-foreground break-words">
        {value}
      </p>
      {hint && <div className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground">{hint}</div>}
    </Component>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PipelineCard — same look but compact, used inside a grouped pipeline panel

export function FinanceiroPipelineCard({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon?: React.ElementType
  label: string
  value: React.ReactNode
  tone: 'warning' | 'info' | 'purple' | 'positive' | 'negative'
  onClick?: () => void
}) {
  const t = TONE_MAP[tone]
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-gradient-to-br to-transparent text-left w-full',
        'ring-1 ring-border/40 p-4 transition-all duration-300',
        'hover:ring-border/70 hover:shadow-[0_4px_20px_-4px_rgb(0_0_0_/_0.08)]',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        t.from,
      )}
    >
      <span className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', t.accent)} />

      <div className="flex items-center gap-2">
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', t.icon)} />}
        <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>
      </div>
      <p className="text-base sm:text-xl font-semibold tracking-tight tabular-nums mt-2 text-foreground break-words">
        {value}
      </p>
    </Component>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PipelineGroup — inset panel that hosts pipeline cards inside a SectionCard

export function PipelineGroup({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-background/60 ring-1 ring-border/40 p-5 space-y-3">
      {title && <p className="text-xs font-semibold tracking-tight">{title}</p>}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MonthPicker — small rounded-pill nav (← Mês YYYY →)

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function MonthPickerPill({
  month,
  year,
  onChange,
  className,
}: {
  month: number
  year: number
  onChange: (month: number, year: number) => void
  className?: string
}) {
  const prev = () => {
    if (month === 1) onChange(12, year - 1)
    else onChange(month - 1, year)
  }
  const next = () => {
    if (month === 12) onChange(1, year + 1)
    else onChange(month + 1, year)
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-full bg-muted/40 backdrop-blur-sm border border-border/30 shadow-sm',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full"
        onClick={prev}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-xs font-medium px-2 min-w-[120px] text-center">
        {MONTHS_PT[month - 1]} {year}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full"
        onClick={next}
        aria-label="Mês seguinte"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

export { MONTHS_PT }
