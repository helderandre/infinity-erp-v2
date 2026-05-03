'use client'

import { TrendingUp, TrendingDown, Receipt, ShoppingBag, Banknote, Sliders } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { UnifiedEntry } from '@/lib/financial/unified-entry'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })

export const TYPE_BADGES: Record<UnifiedEntry['type'], { label: string; cls: string; icon: any }> = {
  commission: {
    label: 'Comissão',
    cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    icon: Banknote,
  },
  shop: {
    label: 'Loja',
    cls: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
    icon: ShoppingBag,
  },
  adjustment: {
    label: 'Ajuste',
    cls: 'bg-slate-500/10 text-slate-700 border-slate-500/30',
    icon: Sliders,
  },
  personal: {
    label: 'Pessoal',
    cls: 'bg-violet-500/10 text-violet-700 border-violet-500/30',
    icon: Receipt,
  },
}

export function UnifiedRow({
  entry, onClick,
}: { entry: UnifiedEntry; onClick?: () => void }) {
  const { label, cls, icon: BadgeIcon } = TYPE_BADGES[entry.type]
  const isCredit = entry.side === 'in'
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl bg-card border border-border/40 px-3 py-2.5 text-left',
        onClick && 'hover:bg-muted/40 hover:border-border transition-colors cursor-pointer',
      )}
    >
      <div className={cn(
        'shrink-0 rounded-full p-2',
        isCredit ? 'bg-emerald-500/10' : 'bg-red-500/10',
      )}>
        {isCredit
          ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          : <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.description}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{fmtDate(entry.date)}</span>
          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 h-4 gap-1', cls)}>
            <BadgeIcon className="h-2.5 w-2.5" />
            {label}
          </Badge>
        </div>
      </div>
      <span className={cn(
        'text-sm font-semibold tabular-nums shrink-0 whitespace-nowrap',
        isCredit ? 'text-emerald-600' : 'text-red-600',
      )}>
        {isCredit ? '+' : '−'} {fmtCurrency(entry.amount)}
      </span>
    </Wrapper>
  )
}
