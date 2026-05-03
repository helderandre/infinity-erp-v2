'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface FunnelConnectorProps {
  /** Editable prose with embedded InlineNumberInput */
  children: ReactNode
  /** Highlight as the "bridge" between two funnel chains */
  variant?: 'normal' | 'bridge' | 'fixed'
  /** Hint shown muted under the prose */
  hint?: string
}

// Vertical connector between two funnel stages. Renders a short downward
// line on top, the editable prose card, and a short downward line below
// — chained back-to-back to give the feel of a connected pipeline.
export function FunnelConnector({ children, variant = 'normal', hint }: FunnelConnectorProps) {
  const isBridge = variant === 'bridge'
  const isFixed = variant === 'fixed'

  return (
    <div className="relative flex w-full flex-col items-center my-1.5">
      {/* top connector */}
      <div className={cn('h-2 w-px', isBridge ? 'bg-primary/40' : 'bg-border/60')} />

      <div
        className={cn(
          'w-full rounded-xl border px-3 py-2 text-[13px] leading-relaxed backdrop-blur-sm shadow-sm',
          isBridge && 'border-dashed border-primary/40 bg-primary/5 supports-[backdrop-filter]:bg-primary/[0.04]',
          isFixed && 'border-emerald-500/30 bg-emerald-50/50 supports-[backdrop-filter]:bg-emerald-50/30 text-emerald-900',
          !isBridge && !isFixed && 'border-border/30 bg-background/30 supports-[backdrop-filter]:bg-background/20'
        )}
      >
        {isBridge && (
          <div className="mb-1 flex items-center justify-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-primary/70">
            <ChevronDown className="h-2.5 w-2.5" />
            Conexão
          </div>
        )}
        <div className="text-center">{children}</div>
        {hint && (
          <div className="mt-0.5 text-center text-[10px] text-muted-foreground/70">
            {hint}
          </div>
        )}
      </div>

      {/* bottom connector */}
      <div className={cn('h-2 w-px', isBridge ? 'bg-primary/40' : 'bg-border/60')} />
    </div>
  )
}
