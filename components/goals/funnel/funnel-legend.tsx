'use client'

import { cn } from '@/lib/utils'

const ITEMS: { color: string; label: string }[] = [
  { color: 'bg-[repeating-linear-gradient(135deg,_transparent_0_4px,_rgba(0,0,0,0.05)_4px_8px)] border border-border/50', label: 'Objetivo' },
  { color: 'bg-emerald-500', label: 'Em linha (≥ 90%)' },
  { color: 'bg-amber-500', label: 'Atenção (50-89%)' },
  { color: 'bg-red-500', label: 'Atrasado (< 50%)' },
]

export function FunnelLegend() {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)] px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
      <span className="text-[10px] tracking-wider uppercase text-muted-foreground font-medium">
        Legenda
      </span>
      {ITEMS.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          <span className={cn('h-2.5 w-6 rounded-full', it.color)} />
          <span className="text-muted-foreground">{it.label}</span>
        </div>
      ))}
    </div>
  )
}
