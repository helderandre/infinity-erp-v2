'use client'

/**
 * Pipeline-phase pill tabs. The active tab shows its icon + label (+ count);
 * inactive tabs show only the phase icon (the label appears once selected).
 * Shared by the leads list view and the gestão consultant drill-down.
 */

import type { ElementType } from 'react'
import { cn } from '@/lib/utils'

export interface PhaseTab {
  key: string
  label: string
  color: string
  /** Optional phase icon. When omitted, a colour-coded dot is shown instead
   *  (used for dynamic pipeline stages that have no dedicated glyph). */
  Icon?: ElementType
  count?: number
}

export function PhaseTabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: PhaseTab[]
  active: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto scrollbar-none', className)}>
      {tabs.map((t) => {
        const isActive = t.key === active
        const Icon = t.Icon
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            title={t.label}
            aria-label={t.label}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border text-[11px] font-medium transition-colors',
              isActive
                ? 'border-transparent px-2.5 py-1 text-white'
                : 'border-border/50 px-1.5 py-1 text-muted-foreground hover:bg-muted/50',
            )}
            style={isActive ? { backgroundColor: t.color } : undefined}
          >
            {Icon ? (
              <Icon className="h-3.5 w-3.5 shrink-0" style={isActive ? undefined : { color: t.color }} />
            ) : (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.9)' : t.color }}
              />
            )}
            {isActive && <span>{t.label}</span>}
            {isActive && t.count != null && (
              <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-bold tabular-nums text-white">
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
